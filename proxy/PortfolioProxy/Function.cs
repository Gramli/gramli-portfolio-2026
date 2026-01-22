using Google.Cloud.Functions.Framework;
using Google.Cloud.Functions.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace PortfolioProxy;

public class AiProxyRequest
{
  [JsonPropertyName("type")]
  public string Type { get; set; } = "chat";

  [JsonPropertyName("prompt")]
  public string Prompt { get; set; }

  [JsonPropertyName("contextData")]
  public string ContextData { get; set; }
}

public class ProxyErrorResponse
{
  [JsonPropertyName("error")]
  public string Error { get; set; }
}

[JsonSerializable(typeof(AiProxyRequest))]
[JsonSerializable(typeof(ProxyErrorResponse))]
internal partial class AiProxyJsonContext : JsonSerializerContext { }

[FunctionsStartup(typeof(Startup))]
public class Function : IHttpFunction
{
  private readonly IHttpClientFactory _httpClientFactory;
  private readonly ILogger<Function> _logger;

  private const string GeminiModel = "gemini-2.0-flash-lite";
  private const string GeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  private const long MaxRequestSize = 512 * 1024;

  public Function(IHttpClientFactory httpClientFactory, ILogger<Function> logger)
  {
    _httpClientFactory = httpClientFactory;
    _logger = logger;
  }

  public async Task HandleAsync(HttpContext context)
  {
    ApplySecurityHeaders(context);

    if (HttpMethods.IsOptions(context.Request.Method))
    {
      context.Response.StatusCode = (int)HttpStatusCode.NoContent;
      return;
    }

    if (!HttpMethods.IsPost(context.Request.Method))
    {
      await SendErrorAsync(context, HttpStatusCode.MethodNotAllowed, "Method not supported.");
      return;
    }

    if (context.Request.ContentLength > MaxRequestSize)
    {
      await SendErrorAsync(context, HttpStatusCode.RequestEntityTooLarge, "Payload exceeds limit.");
      return;
    }

    try
    {
      await ProcessAiRequestAsync(context);
    }
    catch (JsonException)
    {
      await SendErrorAsync(context, HttpStatusCode.BadRequest, "Malformed JSON payload.");
    }
    catch (OperationCanceledException)
    {
      _logger.LogWarning("Request timed out or was canceled by the client.");
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Unhandled exception in AI Proxy.");
      await SendErrorAsync(context, HttpStatusCode.InternalServerError, "Service encountered an internal error.");
    }
  }

  private async Task ProcessAiRequestAsync(HttpContext context)
  {
    var apiKey = Environment.GetEnvironmentVariable("API_KEY");
    if (string.IsNullOrWhiteSpace(apiKey))
    {
      _logger.LogCritical("Deployment configuration error: API_KEY environment variable is missing.");
      await SendErrorAsync(context, HttpStatusCode.InternalServerError, "Backend service is currently unavailable.");
      return;
    }

    var proxyRequest = await JsonSerializer.DeserializeAsync(
        context.Request.Body,
        AiProxyJsonContext.Default.AiProxyRequest);

    if (string.IsNullOrWhiteSpace(proxyRequest?.Prompt))
    {
      await SendErrorAsync(context, HttpStatusCode.BadRequest, "Prompt input is required.");
      return;
    }

    var geminiPayload = BuildGeminiPayload(proxyRequest);
    var endpoint = $"{GeminiBaseUrl}/{GeminiModel}:generateContent?key={apiKey}";

    using var client = _httpClientFactory.CreateClient("GeminiClient");

    using var response = await client.PostAsJsonAsync(endpoint, geminiPayload, context.RequestAborted);

    if (!response.IsSuccessStatusCode)
    {
      var errorBody = await response.Content.ReadAsStringAsync();
      _logger.LogError("Upstream Gemini failure: {Status} - {Body}", response.StatusCode, errorBody);
      await SendErrorAsync(context, response.StatusCode, "Upstream AI error.");
      return;
    }

    context.Response.ContentType = "application/json";
    context.Response.StatusCode = (int)HttpStatusCode.OK;
    await response.Content.CopyToAsync(context.Response.Body);
  }

  private static object BuildGeminiPayload(AiProxyRequest request)
  {
    string systemInstruction = GetSystemInstruction(request);
    var isJobParse = string.Equals(request.Type, "job-parse", StringComparison.OrdinalIgnoreCase);
    var isChat = string.Equals(request.Type, "chat", StringComparison.OrdinalIgnoreCase);

    return new
    {
      contents = new[] { new { parts = new[] { new { text = request.Prompt } } } },
      generationConfig = new
      {
        responseMimeType = isJobParse ? "application/json" : "text/plain",
        temperature = isJobParse ? 0.1 : 0.7
      },
      tools = isChat ? new[] { new { googleSearch = new { } } } : null,
      systemInstruction = new { parts = new[] { new { text = systemInstruction } } }
    };
  }

  private static string GetSystemInstruction(AiProxyRequest request)
  {
    // Security: System prompts are stored server-side to prevent prompt manipulation by the client.
    return request.Type?.ToLowerInvariant() switch
    {
      "job-parse" => "You are a professional HR data extraction engine. " +
                     "Analyze the provided Job Description text and extract a structured JSON representation including: " +
                     "requiredSkills (string[]), niceToHaveSkills (string[]), yearsExperience (number), " +
                     "keyResponsibilities (string[]), and industry domains (string[]). Output RAW JSON only.",

      "chat" => $"You are a sophisticated Portfolio AI Assistant. " +
                $"Current Session Context: {request.ContextData ?? "General"}. " +
                "Keep responses professional and precise. Use Google Search for real-time validation. " +
                "If specific data is unavailable, state: 'Data segment not found in archives.'",

      _ => "You are a helpful AI assistant."
    };
  }

  private static void ApplySecurityHeaders(HttpContext context)
  {
    // Security: Broad CORS for simplicity, but in production, restrict Origin to your domain.
    context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    context.Response.Headers.Append("Access-Control-Allow-Methods", "POST, OPTIONS");
    context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type");

    // Additional Security Headers
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
  }

  private static async Task SendErrorAsync(HttpContext context, HttpStatusCode code, string message)
  {
    context.Response.StatusCode = (int)code;
    context.Response.ContentType = "application/json";
    var errorObj = new ProxyErrorResponse { Error = message };
    await JsonSerializer.SerializeAsync(
        context.Response.Body,
        errorObj,
        AiProxyJsonContext.Default.ProxyErrorResponse);
  }
}
