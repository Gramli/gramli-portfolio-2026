import { Injectable } from '@angular/core';

export interface VisitorInfo {
  browser: string;
  os: string;
  screenResolution: string;
  language: string;
  width: number;
  height: number;
  location?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VisitorInfoService {

  async getVisitorInfo(): Promise<VisitorInfo> {
    const userAgent = navigator.userAgent;
    const language = navigator.language;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const location = await this.getLocation();
    
    return {
      browser: this.getBrowser(userAgent),
      os: this.getOS(userAgent),
      screenResolution: `${width}x${height}`,
      width,
      height,
      language: language,
      location: location
    };
  }

  private async getLocation(): Promise<string> {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return `${data.city}, ${data.country_code}`;
    } catch (e) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }

  private getBrowser(ua: string): string {
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("SamsungBrowser") > -1) return "Samsung Internet";
    if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
    if (ua.indexOf("Trident") > -1) return "Internet Explorer";
    if (ua.indexOf("Edge") > -1) return "Edge";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    return "Unknown Agent";
  }

  private getOS(ua: string): string {
    if (ua.indexOf("Win") !== -1) return "Windows OS";
    if (ua.indexOf("Mac") !== -1) return "macOS";
    if (ua.indexOf("Linux") !== -1) return "Linux Kernel";
    if (ua.indexOf("Android") !== -1) return "Android";
    if (ua.indexOf("like Mac") !== -1) return "iOS";
    return "Unknown System";
  }
}
