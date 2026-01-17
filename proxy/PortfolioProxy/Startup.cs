using Google.Cloud.Functions.Hosting;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System;

namespace PortfolioProxy
{
  public class Startup : FunctionsStartup
  {
    public override void ConfigureServices(WebHostBuilderContext context, IServiceCollection services)
    {
      services.AddHttpClient("GeminiClient", client =>
      {
        client.Timeout = TimeSpan.FromSeconds(30);
        client.DefaultRequestHeaders.Add("User-Agent", "Portfolio-AI-Proxy/1.0");
      });
    }
  }
}
