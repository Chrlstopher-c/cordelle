// CSS personnalisé local : injecté dans <style id="cordelle-custom-css"> tant qu'il est activé.
const STYLE_ID = "cordelle-custom-css";

export function applyCustomCss(css: string | null): void {
  const current = document.getElementById(STYLE_ID);
  if (css === null) {
    current?.remove();
    return;
  }
  const el = current ?? document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = css;
  if (!current) document.head.append(el);
}
