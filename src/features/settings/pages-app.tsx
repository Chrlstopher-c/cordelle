// Pages « Application » : Apparence et Accessibilité (réglages locaux appliqués tout de suite).
import { Card, Row, Segmented, Slider, Toggle } from "./controls";
import { ACCENTS, DEFAULTS, useSettings, type AppSettings } from "./settings-store";

function Changed({ keys }: { keys: (keyof AppSettings)[] }): React.JSX.Element {
  const s = useSettings();
  const changed = keys.filter((k) => s[k] !== DEFAULTS[k]);
  return (
    <div className="st-sub">
      {changed.length === 0 ? "Les changements s'appliquent tout de suite." : (
        <>{changed.length} réglage{changed.length > 1 ? "s" : ""} modifié{changed.length > 1 ? "s" : ""} ·
          <button onClick={() => s.reset(changed)}>Tout réinitialiser</button></>
      )}
    </div>
  );
}

const APPEARANCE: (keyof AppSettings)[] = ["theme", "accent", "density", "fontSize", "groupGap", "zoom"];

export function AppearancePage(): React.JSX.Element {
  const s = useSettings();
  const ch = (k: keyof AppSettings): boolean => s[k] !== DEFAULTS[k];
  return (
    <>
      <h1>Apparence</h1>
      <Changed keys={APPEARANCE} />
      <Card title="Thème">
        <Row title="Thème" hint="Système suit le réglage de Linux." changed={ch("theme")}>
          <Segmented value={s.theme} onChange={(v) => s.set("theme", v)}
            options={[{ v: "dark", label: "Sombre" }, { v: "light", label: "Clair" }, { v: "system", label: "Système" }]} />
        </Row>
        <Row title="Couleur d'accent" hint="Boutons, liens, mentions." changed={ch("accent")}>
          <div style={{ display: "flex", gap: 8 }}>
            {ACCENTS.map((a) => (
              <button key={a.hex} className="st-swatch" aria-label={a.label} title={a.label} onClick={() => s.set("accent", a.hex)}
                style={{ background: a.hex, boxShadow: s.accent === a.hex ? "0 0 0 2px var(--surface-raised), 0 0 0 4px var(--text)" : "none" }} />
            ))}
          </div>
        </Row>
      </Card>
      <Card title="Messages">
        <Row title="Densité" hint="Confortable : avatar et nom au-dessus. Compacte : une ligne par message." changed={ch("density")}>
          <Segmented value={s.density} onChange={(v) => s.set("density", v)}
            options={[{ v: "comfy", label: "Confortable" }, { v: "compact", label: "Compacte" }]} />
        </Row>
        <Row title="Taille du texte" hint="Corps des messages, de 12 à 20 px." changed={ch("fontSize")}>
          <Slider label="Taille du texte" value={s.fontSize} min={12} max={20} unit=" px" onChange={(v) => s.set("fontSize", v)} />
        </Row>
        <Row title="Espace entre les groupes" hint="Plus d'air entre deux auteurs différents." changed={ch("groupGap")}>
          <Slider label="Espace entre les groupes" value={s.groupGap} min={0} max={24} step={2} unit=" px" onChange={(v) => s.set("groupGap", v)} />
        </Row>
      </Card>
      <Card title="Fenêtre">
        <Row title="Zoom de l'interface" hint="Agrandit tout, texte et boutons." changed={ch("zoom")}>
          <Slider label="Zoom" value={s.zoom} min={80} max={150} step={10} unit=" %" onChange={(v) => s.set("zoom", v)} />
        </Row>
      </Card>
    </>
  );
}

export function AccessibilityPage(): React.JSX.Element {
  const s = useSettings();
  return (
    <>
      <h1>Accessibilité</h1>
      <Changed keys={["reduceMotion"]} />
      <Card title="Mouvement">
        <Row title="Réduire les animations" hint="Coupe les transitions et animations de l'interface." changed={s.reduceMotion !== DEFAULTS.reduceMotion}>
          <Toggle label="Réduire les animations" on={s.reduceMotion} onChange={(v) => s.set("reduceMotion", v)} />
        </Row>
      </Card>
    </>
  );
}
