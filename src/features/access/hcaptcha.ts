// hCaptcha chargé à la demande, en rendu explicite, dans la fenêtre de l'app.
export interface HCaptchaOptions {
  sitekey: string;
  rqdata?: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
}

export interface HCaptchaApi {
  render: (container: HTMLElement, options: HCaptchaOptions) => string;
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

const SCRIPT_URL = "https://js.hcaptcha.com/1/api.js?render=explicit";
let pending: Promise<HCaptchaApi> | null = null;

function injectScript(): Promise<HCaptchaApi> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.hcaptcha) resolve(window.hcaptcha);
      else reject(new Error("hCaptcha absent après chargement"));
    };
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error("chargement de hCaptcha impossible"));
    };
    document.head.appendChild(script);
  });
}

export function loadHcaptcha(): Promise<HCaptchaApi> {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  pending ??= injectScript();
  return pending;
}
