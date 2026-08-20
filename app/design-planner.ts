export type DesignOption = {
  value: string;
  label: string;
  description: string;
};

export type DesignQuestion = {
  id: string;
  title: string;
  hint: string;
  options: DesignOption[];
};

export type DesignPlan = {
  planVersion: "ab3d-print-plan-v2";
  templateId: string;
  productName: string;
  customerIdea: string;
  intro: string;
  questions: DesignQuestion[];
  answers: Record<string, string>;
  summary: string;
  parts: string[];
  specifications: string[];
  safetyNotes: string[];
  manufacturing: ManufacturingPlan;
  technicalBrief: string;
  complete: boolean;
  requiresProductionReview: true;
};

export type ManufacturingPlan = {
  strategy: "single-part" | "multi-part" | "print-in-place";
  printedParts: string[];
  sourcedComponents: string[];
  interfaces: string[];
  assemblySteps: string[];
  excludedGeometry: string[];
  meshDirective: string;
};

type Blueprint = {
  name: string;
  intro: string;
  questions: DesignQuestion[];
  parts: (answers: Record<string, string>) => string[];
  specs: (answers: Record<string, string>) => string[];
  safety: (answers: Record<string, string>) => string[];
  mesh: (idea: string, answers: Record<string, string>) => string;
};

const option = (value: string, label: string, description: string): DesignOption => ({ value, label, description });

const commonStyleQuestion: DesignQuestion = {
  id: "form_language",
  title: "Welche Formensprache passt zu deiner Idee?",
  hint: "Die Auswahl steuert Silhouette, Details und Stabilität.",
  options: [
    option("organic", "Organisch", "Weiche Übergänge und ruhige, fliessende Volumen."),
    option("minimal", "Minimal", "Klare Silhouette, wenige Details und einfacher Druck."),
    option("sculptural", "Skulptural", "Ausdrucksstarke Form mit kontrollierten Vertiefungen."),
    option("geometric", "Geometrisch", "Rhythmische Flächen und sauber definierte Kanten."),
  ],
};

const freePurposeQuestion: DesignQuestion = {
  id: "product_purpose",
  title: "Was soll deine Idee hauptsächlich können?",
  hint: "Damit der Planer nicht nur die Form, sondern den richtigen technischen Aufbau auswählt.",
  options: [
    option("light", "Lampe & Lichtobjekt", "Mit sicherem Hohlraum, Zugang und Platz für ein Niedervolt-LED-Modul."),
    option("planter", "Pflanzgefäss", "Mit nutzbarem Pflanzraum, sicherem Stand und passender Wasserführung."),
    option("container", "Aufbewahrung & Halter", "Mit echtem Innenraum, Ablage, Öffnung oder tragender Funktion."),
    option("moving", "Bewegliches Objekt", "Mit Gelenken, Spiel oder mehreren zusammenpassenden Teilen."),
    option("terrain", "Spiel & Gelände", "Mit flacher Basis, robusten Spielflächen und passendem Massstab."),
    option("figure", "Figur & Skulptur", "Als stabile Figur oder freie Skulptur mit verbundenen Details."),
    option("decor", "Dekoration", "Als robustes Designobjekt ohne besondere Mechanik."),
    option("other", "Etwas anderes", "Der Planer klärt Aufbau und Belastung mit allgemeinen Druckregeln."),
  ],
};

const freeConstructionQuestion: DesignQuestion = {
  id: "construction",
  title: "Wie soll das Produkt aufgebaut sein?",
  hint: "Wähle die einfachste Variante, die deine Idee zuverlässig erfüllt.",
  options: [
    option("single", "Ein stabiles Teil", "Einfacher Druck ohne Montage; geeignet für Figuren, Halter und Dekoration."),
    option("multi", "Mehrere steckbare Teile", "Einzelteile werden mit klaren Passungen und Montagespiel geplant."),
    option("hollow", "Hohl mit Öffnung", "Nutzbarer Innenraum mit definierter Wand und gut erreichbarer Öffnung."),
  ],
};

const freeLoadQuestion: DesignQuestion = {
  id: "usage_load",
  title: "Wie wird das Produkt im Alltag beansprucht?",
  hint: "Das bestimmt Basis, Materialstärken und empfindliche Details.",
  options: [
    option("display", "Steht hauptsächlich als Designobjekt", "Standsicherheit und saubere Silhouette stehen im Vordergrund."),
    option("daily", "Wird täglich angefasst", "Kanten, Griffe und Verbindungen werden besonders robust ausgelegt."),
    option("support", "Soll etwas tragen oder halten", "Breite Auflage, Lastpfad und Kippsicherheit werden priorisiert."),
  ],
};

const freeContainerQuestion: DesignQuestion = {
  id: "container_access",
  title: "Wie soll Inhalt oder Objekt eingesetzt werden?",
  hint: "Der Zugang muss im fertigen Druck wirklich nutzbar bleiben.",
  options: [
    option("open", "Offen zugänglich", "Offene Ablage, Halterung oder Gefäss ohne Deckel."),
    option("lid", "Mit abnehmbarem Deckel", "Zweiteilige Lösung mit sichtbarer Trennlinie und Montagespiel."),
    option("slot", "Über Schlitz oder Führung", "Gezielte Aufnahme für Kabel, Karten oder ein bestimmtes Objekt."),
  ],
};

const blueprints: Record<string, Blueprint> = {
  lamp: {
    name: "Skulpturale LED-Lampe",
    intro: "Eine Lampe muss nicht nur schön aussehen: Lichtquelle, Hohlraum, Zugang, Wärmeabstand, Kabelweg und Stand müssen zusammen funktionieren. Ich kläre deshalb zuerst den Aufbau.",
    questions: [
      {
        id: "lamp_concept",
        title: "Welche Design-Richtung gefällt dir am besten?",
        hint: "Wähle die Grundidee – dein eigener Wunsch bleibt Teil des Designs.",
        options: [
          option("moon_sphere", "Klassische Mondkugel", "Runde Leuchtkugel mit Kraterrelief auf einem schlichten Sockel."),
          option("branch_stand", "Mond auf Astständer", "Die Kugel ruht auf einem organisch geformten, stabilen Ständer."),
          option("hands", "Mond in Händen", "Zwei stilisierte Hände tragen die Leuchtkugel als Geschenkobjekt."),
          option("space", "Weltraum-Thema", "Mond mit abstrahiertem Raketen- oder Astronauten-Sockel."),
        ],
      },
      {
        id: "lamp_use",
        title: "Wofür soll die Lampe genutzt werden?",
        hint: "Nur bei einer echten Leuchte planen wir einen sicheren Innenraum für das Lichtmodul.",
        options: [
          option("led", "Mit LED-Beleuchtung", "Hohle Lichtschale, separater Sockel, Zugang und Kabelführung."),
          option("decor", "Nur Deko (kein Licht)", "Reines 3D-Dekorobjekt ohne elektrischen Innenraum."),
        ],
      },
      {
        id: "lamp_module",
        title: "Welches Lichtmodul soll eingesetzt werden?",
        hint: "AB3D plant nur für geprüfte Niedervolt-LEDs mit geringer Wärmeentwicklung.",
        options: [
          option("usb_puck", "USB-LED-Modul", "Empfohlen: flaches 5-V-Modul im zugänglichen Sockel."),
          option("led_tealight", "LED-Teelicht", "Batteriebetrieben und herausnehmbar, ohne echtes Feuer."),
          option("custom", "Eigenes LED-Modul", "Die genauen Modulmasse werden vor dem Druck geprüft."),
        ],
      },
    ],
    parts: (a) => a.lamp_use === "decor"
      ? ["Dekorative Hauptform", "Breiter, plan aufliegender Sockel"]
      : ["Hohle, lichtdurchlässige Leuchtschale", "Separater standsicherer Sockel mit Kabelkanal", "Abnehmbare Service-Abdeckung"],
    specs: (a) => a.lamp_use === "decor"
      ? ["Geschlossene, wasserdichte Dekorgeometrie", "Flache Standfläche", "Keine schwebenden oder papierdünnen Details"]
      : ["Leuchtschale als geschlossenes Hohlteil mit gleichmässiger Wand von ca. 1,6–2,0 mm", "Mechanisch getrenntes Niedervolt-LED-Modul; keine gedruckte Netzspannungsfassung", "Werkzeuglos erreichbare Öffnung im Sockel", "Mindestens 0,5 mm Montagespiel an lösbaren Passungen", "Verdeckter Kabelkanal ohne scharfe Kanten", "Breite, kippsichere Standfläche und kontrollierte Lüftungsöffnung"],
    safety: (a) => a.lamp_use === "decor"
      ? ["Dekorobjekt ist nicht als Leuchte ausgewiesen."]
      : ["Nur geprüfte 5-V/12-V-Niedervolt-LED mit geringer Wärmeentwicklung verwenden.", "Kein offenes Feuer und keine Glühlampe einsetzen.", "Modulmasse, Temperatur, Wandstärke und Passung müssen vor Verkauf durch AB3D geprüft werden."],
    mesh: (idea, a) => a.lamp_use === "decor"
      ? `Create a solid decorative ${a.lamp_concept || "sculptural"} moon-inspired object based on: ${idea}. Use a broad integrated base, robust relief and no lighting cavity.`
      : `Create a functional two-part ${a.lamp_concept || "moon"} ambient LED lamp based on: ${idea}. Clearly model a hollow translucent outer light shell and a separate broad base. The base contains a low-voltage ${a.lamp_module || "USB LED"} cavity, removable access panel, concealed cable channel and ventilation gap. Do not model a bulb, flame, mains socket, cable or electronics as fused plastic.`,
  },
  "twist-egg": {
    name: "Twist Egg",
    intro: "Bei einem drehbaren Behälter sind Passung, Öffnungsweg und Wandstärke wichtiger als reine Optik. Ich lege diese Punkte mit dir fest.",
    questions: [
      commonStyleQuestion,
      { id: "egg_use", title: "Was soll im Twist Egg Platz finden?", hint: "Der Inhalt bestimmt Grösse und Innenraum.", options: [option("jewelry", "Schmuck", "Kompakter Innenraum mit weichen Kanten."), option("gift", "Kleine Geschenke", "Etwas mehr Volumen und leichtes Öffnen."), option("decor", "Nur Dekoration", "Fokus auf die äussere Skulptur.")] },
      { id: "closure", title: "Wie soll es sich öffnen?", hint: "Wir vermeiden zu enge oder brüchige Passungen.", options: [option("twist", "Kurze Drehbewegung", "Geführte Drehung mit grosszügigem Spiel."), option("lift", "Aufsteckdeckel", "Einfacher Deckel ohne Gewinde."), option("free", "Freie zweiteilige Form", "Zwei passende Hälften ohne Verriegelung.")] },
    ],
    parts: () => ["Stabile untere Schale", "Passende obere Schale"],
    specs: () => ["0,5–0,7 mm Spiel zwischen bewegten Flächen", "Mindestens 1,6 mm Wandstärke", "Gerundete Führungsflächen", "Breite Standfläche"],
    safety: () => ["Passung wird mit Testdruck validiert; nicht für Lebensmittel zertifiziert."],
    mesh: (idea, a) => `Create a functional two-part ${a.form_language || "organic"} twist container based on: ${idea}. Show separate upper and lower shells with a clear seam, broad base, 0.6 mm assembly clearance, rounded guides and no fused moving surfaces.`,
  },
  planter: {
    name: "Blumentopf",
    intro: "Ein guter Pflanztopf braucht Volumen, Ablauf, Untersetzer und sicheren Stand. Ich kläre kurz Pflanze und Wasserführung.",
    questions: [
      commonStyleQuestion,
      { id: "plant_size", title: "Welche Pflanze soll hinein?", hint: "Das beeinflusst Öffnung und Standfläche.", options: [option("succulent", "Sukkulente", "Kleiner, flacher Pflanzraum."), option("houseplant", "Zimmerpflanze", "Mittlere Öffnung mit stabilem Volumen."), option("herb", "Kräuter", "Breite Öffnung und guter Wasserablauf.")] },
      { id: "drainage", title: "Wie soll Wasser ablaufen?", hint: "Ein echter Pflanztopf braucht kontrollierte Drainage.", options: [option("saucer", "Loch + Untersetzer", "Empfohlene zweiteilige Lösung."), option("cachepot", "Geschlossener Übertopf", "Ohne Loch; Innentopf wird herausgenommen."), option("reservoir", "Kleines Reservoir", "Separater Wasserraum, vor Druck technisch zu prüfen.")] },
    ],
    parts: (a) => a.drainage === "saucer" ? ["Pflanzgefäss", "Separater Untersetzer"] : ["Pflanzgefäss"],
    specs: (a) => ["Durchgehende Wand von mindestens 1,8 mm", "Breite, plane Standfläche", a.drainage === "saucer" ? "Definiertes Ablaufloch und ausreichend grosser Untersetzer" : "Geschlossener Innenraum ohne unbeabsichtigte Öffnungen", "Keine tiefen unzugänglichen Hinterschneidungen"],
    safety: () => ["Wasserdichtheit und Materialverträglichkeit werden vor Verkauf geprüft."],
    mesh: (idea, a) => `Create a functional ${a.form_language || "sculptural"} plant pot based on: ${idea}. Include a usable open planting cavity, thick continuous walls, broad flat base and ${a.drainage === "saucer" ? "a separate coordinated saucer with drainage hole" : "a closed cachepot interior"}. Do not fill the planting cavity.`,
  },
  "fold-fidget": {
    name: "Einklapp-Fidget",
    intro: "Ein bewegliches Print-in-Place-Objekt funktioniert nur mit robusten Segmenten und definiertem Gelenkspiel.",
    questions: [commonStyleQuestion, { id: "motion", title: "Welche Bewegung wünschst du?", hint: "Die Bewegung bestimmt die Gelenkanordnung.", options: [option("fold", "Falten", "Segmente klappen zu einer kompakten Form."), option("loop", "Endlosschleife", "Wiederholte ruhige Drehbewegung."), option("click", "Rasterbewegung", "Deutlich geführte Positionen ohne lose Teile.")] }, { id: "hand", title: "Für welche Handgrösse?", hint: "Damit das Objekt angenehm und sicher bedienbar bleibt.", options: [option("small", "Klein", "Kompakt mit kräftigen Segmenten."), option("medium", "Mittel", "Ausgewogene Standardgrösse."), option("large", "Gross", "Breitere Segmente und grössere Radien.")] }],
    parts: () => ["Zusammenhängende Print-in-Place-Segmentkette mit gefangenen Gelenken"],
    specs: () => ["0,5–0,7 mm Gelenkspiel", "Mindestens 2,2 mm starke Gelenkachsen", "Abgerundete Handkanten", "Keine losen Kleinteile"],
    safety: () => ["Nicht für Kleinkinder; Gelenkspiel wird mit Testdruck geprüft."],
    mesh: (idea, a) => `Create a print-in-place ${a.form_language || "geometric"} hand fidget based on: ${idea}. Use chunky repeating segments, captured ${a.motion || "folding"} hinges, 0.6 mm clearances, rounded edges and no separate loose parts.`,
  },
  terrain: {
    name: "Tabletop-Terrain",
    intro: "Spielbares Gelände braucht eine plane Basis, klare Wege, robuste Details und definierte Modulränder.",
    questions: [commonStyleQuestion, { id: "terrain_type", title: "Welche Landschaft soll entstehen?", hint: "Wähle die spielerische Grundstruktur.", options: [option("mountain", "Felsen & Berge", "Höhenstufen und robuste Klippen."), option("ruins", "Ruinen", "Begehbare Ebenen und kräftige Mauern."), option("forest", "Wald & Wege", "Freie Spielflächen mit niedrigen Naturelementen.")] }, { id: "system", title: "Wie soll das Modul genutzt werden?", hint: "Die Kanten müssen zum Spielfeld passen.", options: [option("single", "Einzelstück", "Freie Kontur auf flacher Basis."), option("square", "Quadratisches Modul", "Gerade, anschlussfähige Kanten."), option("hex", "Hex-Modul", "Sechseckige, wiederholbare Grundfläche.")] }],
    parts: () => ["Einteilige Geländekachel"],
    specs: (a) => ["Vollständig plane Unterseite", `${a.system === "hex" ? "Sechseckige" : a.system === "square" ? "Quadratische" : "Stabile"} Grundkontur`, "Robuste begehbare Ebenen", "Keine dünnen freistehenden Äste oder Mauern"],
    safety: () => ["Massstab und Modulmass werden vor Fertigung bestätigt."],
    mesh: (idea, a) => `Create a playable ${a.terrain_type || "rocky"} tabletop terrain ${a.system || "tile"} based on: ${idea}. Use a perfectly flat underside, clear walkable levels, strong walls and bridges, compatible clean borders and no fragile unsupported details.`,
  },
};

const genericBlueprint: Blueprint = {
  name: "Individuelles 3D-Produkt",
  intro: "Ich übersetze deine Idee zuerst in Funktion, Aufbau und robuste Druckregeln.",
  questions: [commonStyleQuestion, { id: "purpose", title: "Wofür wird das Produkt verwendet?", hint: "Die Nutzung bestimmt Stabilität und Geometrie.", options: [option("decor", "Dekoration", "Fokus auf Silhouette und sicheren Stand."), option("container", "Aufbewahrung", "Nutzbarer Innenraum und robuste Wände."), option("interactive", "Bewegliches Objekt", "Definierte Teile und kontrolliertes Spiel.")] }],
  parts: (a) => a.construction === "multi" ? ["Stabiler Hauptkörper", "Separates, passend konstruiertes Funktionsteil"] : [a.construction === "hollow" ? "Hohler, zugänglicher Hauptkörper" : "Druckbarer Hauptkörper"],
  specs: (a) => ["Geschlossene, wasserdichte Geometrie", "Stabile Stand- oder Auflagefläche", "Keine schwebenden oder papierdünnen Details", a.construction === "multi" ? "0,5–0,7 mm Montagespiel zwischen steckbaren Teilen" : "Zusammenhängende, robuste Volumen", a.usage_load === "support" ? "Breiter Lastpfad mit verstärkten Übergängen; Tragfähigkeit wird per Testdruck geprüft" : "Mindestens 1,6 mm praktische Wandstärke"],
  safety: () => ["Kritische Masse und Funktion werden vor Fertigung geprüft."],
  mesh: (idea, a) => `Create a functional ${a.form_language || "clean"} 3D-printable ${a.product_purpose === "figure" ? "figure or sculpture" : "product"} based on: ${idea}. Use ${a.construction === "multi" ? "clearly separated, assembleable parts with visible seams" : a.construction === "hollow" ? "a usable hollow interior with a clear opening and continuous walls" : "one coherent printable body"}, robust connected volumes, a stable base and no floating or paper-thin details. ${a.usage_load === "support" ? "Give it a broad load-bearing footprint and reinforced transitions." : ""}`,
};

const freeContainerBlueprint: Blueprint = {
  name: "Individuelles Funktionsprodukt",
  intro: "Ich übersetze deine freie Idee in einen nutzbaren Innenraum, eine stabile Auflage und einen druckbaren Zugang.",
  questions: [commonStyleQuestion, freeContainerQuestion, freeLoadQuestion],
  parts: (a) => a.container_access === "lid" ? ["Stabiler Hauptkörper mit nutzbarem Innenraum", "Abnehmbarer, passend konstruierter Deckel"] : ["Stabiler Hauptkörper mit nutzbarem Innenraum oder definierter Aufnahme"],
  specs: (a) => ["Nutzbarer Hohlraum oder eindeutig definierte Aufnahme", "Durchgehende Wand von mindestens 1,8 mm", "Breite, plane Stand- oder Auflagefläche", a.container_access === "lid" ? "0,5–0,7 mm Spiel zwischen Deckel und Hauptkörper" : a.container_access === "slot" ? "Einführschlitz mit gerundeten Kanten und ausreichend Einführspiel" : "Gut erreichbare offene Geometrie", a.usage_load === "support" ? "Verstärkte Lastzone und Testdruck unter vorgesehener Belastung" : "Robuste Übergänge ohne fragile Spitzen"],
  safety: () => ["Innenmass, Belastung und Passung werden vor Fertigung anhand des echten Einsatzes bestätigt."],
  mesh: (idea, a) => `Create a functional ${a.form_language || "clean"} 3D-printable storage or support product based on: ${idea}. Include a genuinely usable ${a.container_access === "slot" ? "slot or guided holder" : "open interior cavity"}, thick continuous walls and a broad stable footprint. ${a.container_access === "lid" ? "Create a separate removable lid with a visible seam and 0.6 mm clearance; do not fuse it to the body." : ""} ${a.usage_load === "support" ? "Reinforce load-bearing transitions and avoid a narrow top-heavy base." : ""}`,
};

function resolveFreeBlueprint(purpose?: string) {
  if (purpose === "light") return blueprints.lamp;
  if (purpose === "planter") return blueprints.planter;
  if (purpose === "moving") return blueprints["fold-fidget"];
  if (purpose === "terrain") return blueprints.terrain;
  if (purpose === "container") return freeContainerBlueprint;
  return genericBlueprint;
}

function getFreeDesignQuestions(answerInput: Record<string, string>) {
  const selectedPurpose = freePurposeQuestion.options.find((entry) => entry.value === answerInput.product_purpose)?.value;
  if (!selectedPurpose) return [freePurposeQuestion];
  if (selectedPurpose === "light") return [freePurposeQuestion, ...blueprints.lamp.questions];
  if (selectedPurpose === "planter") return [freePurposeQuestion, ...blueprints.planter.questions];
  if (selectedPurpose === "moving") return [freePurposeQuestion, ...blueprints["fold-fidget"].questions];
  if (selectedPurpose === "terrain") return [freePurposeQuestion, ...blueprints.terrain.questions];
  if (selectedPurpose === "container") return [freePurposeQuestion, commonStyleQuestion, freeContainerQuestion, freeLoadQuestion];
  return [freePurposeQuestion, commonStyleQuestion, freeConstructionQuestion, freeLoadQuestion];
}

function inferExternalComponents(idea: string) {
  const normalized = idea.toLocaleLowerCase("de-CH");
  const sourcedComponents: string[] = [];
  const excludedGeometry: string[] = [];
  if (/\b(usb|kabel|stromkabel|ladekabel)\b/u.test(normalized)) {
    sourcedComponents.push("USB-/Stromkabel nach benötigtem Anschluss (Kauf- oder Nutzerteil)");
    excludedGeometry.push("USB- oder Stromkabel");
  }
  if (/\b(led|beleuchtung|leuchte|lichtmodul)\b/u.test(normalized)) {
    sourcedComponents.push("Geprüftes Niedervolt-LED-Modul (Kaufteil)");
    excludedGeometry.push("LED-Modul");
  }
  if (/\b(akku|batterie|batteriefach)\b/u.test(normalized)) {
    sourcedComponents.push("Passende Batterie oder Akku-Einheit (Kaufteil)");
    excludedGeometry.push("Batterie oder Akku");
  }
  if (/\b(motor|lautsprecher|schalter)\b/u.test(normalized)) {
    sourcedComponents.push("Genanntes Elektronik- oder Mechanikmodul nach bestätigten Einbaumassen (Kaufteil)");
    excludedGeometry.push("Motor, Lautsprecher oder Schalter");
  }
  if (/\b(magnet|magnete)\b/u.test(normalized)) {
    sourcedComponents.push("Passender Magnet nach bestätigten Einbaumassen (Kaufteil)");
    excludedGeometry.push("Magnet");
  }
  if (/\b(schraube|schrauben|mutter|muttern)\b/u.test(normalized)) {
    sourcedComponents.push("Schrauben und Muttern nach bestätigten Einbaumassen (Kaufteile)");
    excludedGeometry.push("Schrauben und Muttern");
  }
  if (/\b(kopfhörer|telefon|smartphone|tablet|karte|karten)\b/u.test(normalized)) {
    excludedGeometry.push("das vom Halter aufzunehmende Nutzerobjekt");
  }
  return { sourcedComponents, excludedGeometry };
}

function buildManufacturingPlan(templateId: string, answers: Record<string, string>, printedParts: string[], idea: string): ManufacturingPlan {
  const productKind = templateId === "free-design"
    ? answers.product_purpose === "light" ? "lamp"
      : answers.product_purpose === "planter" ? "planter"
        : answers.product_purpose === "moving" ? "fold-fidget"
          : answers.product_purpose === "terrain" ? "terrain"
            : answers.product_purpose === "container" ? "container"
              : "generic"
    : templateId;
  const commonExclusions = ["Text, Logo und dekorative Szene", "Stützmaterial als Bestandteil des Produktmodells"];
  const inferredExternal = inferExternalComponents(idea);

  if (productKind === "lamp" && answers.lamp_use !== "decor") {
    const lightComponent = answers.lamp_module === "led_tealight"
      ? "Batteriebetriebenes LED-Teelicht (Kaufteil)"
      : answers.lamp_module === "custom"
        ? "Geprüftes Niedervolt-LED-Modul nach bestätigten Einbaumassen (Kaufteil)"
        : "Flaches 5-V-USB-LED-Modul (Kaufteil)";
    const powerComponent = answers.lamp_module === "led_tealight" ? [] : ["USB-Kabel und passendes Niedervolt-Netzteil (Kaufteile)"];
    return {
      strategy: "multi-part",
      printedParts,
      sourcedComponents: [lightComponent, ...powerComponent],
      interfaces: [
        "Leuchtschale zu Sockel: lösbare Steck- oder kurze Drehpassung mit 0,5–0,7 mm Spiel",
        "Service-Abdeckung zu Sockel: werkzeuglos lösbar mit mindestens 0,5 mm Spiel",
        "Kabelausgang: offene, gerundete Durchführung mit Zugentlastungsraum",
      ],
      assemblySteps: [
        "USB-Kabel durch die offene Durchführung des Sockels führen.",
        "Das echte LED-Modul in die dafür vorgesehene Aufnahme einsetzen – nicht drucken.",
        "Service-Abdeckung einsetzen und danach die Leuchtschale lösbar auf dem Sockel montieren.",
      ],
      excludedGeometry: ["USB-Kabel", "LED-Modul", "Netzteil", "Schalter", "Glühlampe", "Flamme", "Netzspannungsfassung", ...commonExclusions],
      meshDirective: "Exactly 3 separate watertight print solids, exploded 12 mm apart and never touching: (1) hollow light shell, (2) broad base with EMPTY LED pocket and OPEN cable channel, (3) service cover. Flat print faces down; matching 0.6 mm fits. NEVER include cable, LED, power supply, switch, bulb, flame or socket.",
    };
  }

  if (productKind === "twist-egg") {
    return {
      strategy: "multi-part",
      printedParts,
      sourcedComponents: [],
      interfaces: ["Obere zu untere Schale: sichtbare Trennfuge und 0,5–0,7 mm Dreh- oder Steckspiel"],
      assemblySteps: ["Beide Schalen getrennt drucken.", "Kontaktflächen entgraten und Passung mit einem kurzen Testdruck prüfen.", "Oberteil ohne Kraft aufsetzen oder kurz verdrehen."],
      excludedGeometry: ["Metallscharnier", "Magnet", "Schraube", ...commonExclusions],
      meshDirective: "Generate exactly 2 separate disconnected watertight printable solids as an exploded kit: lower container shell and matching upper shell. Place them 12 mm apart with flat print faces down. Keep a visible seam and 0.6 mm functional clearance. Never fuse, overlap or add hardware.",
    };
  }

  if (productKind === "planter" && answers.drainage === "saucer") {
    return {
      strategy: "multi-part",
      printedParts,
      sourcedComponents: ["Pflanze, Erde und Wasser (keine Modellgeometrie)"],
      interfaces: ["Topf zu Untersetzer: freie Auflage ohne Verriegelung", "Ablaufloch vollständig offen und über dem Untersetzer positioniert"],
      assemblySteps: ["Topf und Untersetzer getrennt drucken.", "Ablaufloch auf freien Durchgang prüfen.", "Topf mittig auf den Untersetzer stellen."],
      excludedGeometry: ["Pflanze", "Erde", "Wasser", ...commonExclusions],
      meshDirective: "Generate exactly 2 separate disconnected watertight printable solids as an exploded kit: open plant pot with real empty planting cavity and open drainage hole, plus a separate saucer. Place 12 mm apart, flat-side down, never touching. Do not generate plant, soil or water.",
    };
  }

  if (productKind === "fold-fidget") {
    return {
      strategy: "print-in-place",
      printedParts,
      sourcedComponents: [],
      interfaces: ["Gefangene Gelenke: 0,5–0,7 mm umlaufendes Spiel; Achsen mindestens 2,2 mm"],
      assemblySteps: ["Als zusammenhängendes Print-in-Place-Teil drucken.", "Nach dem Abkühlen jedes Gelenk vorsichtig einzeln lösen.", "Bewegung und Kleinteilrisiko prüfen."],
      excludedGeometry: ["Separate lose Achsen", "Metallstifte", "Federn", ...commonExclusions],
      meshDirective: "Generate one watertight print-in-place assembly with captured hinges. Keep every moving surface separated by 0.6 mm and hinge pins at least 2.2 mm thick. No loose pins, springs, metal or fused joints.",
    };
  }

  if (productKind === "container" && answers.container_access === "lid") {
    return {
      strategy: "multi-part",
      printedParts,
      sourcedComponents: inferredExternal.sourcedComponents,
      interfaces: ["Deckel zu Hauptkörper: umlaufend 0,5–0,7 mm Spiel mit Einführfase"],
      assemblySteps: ["Hauptkörper und Deckel getrennt drucken.", "Passflächen entgraten und Testpassung ohne Kraft durchführen."],
      excludedGeometry: ["Inhalt des Behälters", "Metallscharnier", ...inferredExternal.excludedGeometry, ...commonExclusions],
      meshDirective: `Generate exactly 2 separate disconnected watertight printable solids as an exploded kit: usable hollow body and removable lid. Place 12 mm apart, flat-side down. Use a visible seam, entry chamfer and 0.6 mm clearance. Never fuse parts, fill the cavity or generate accessories. Exclude: ${inferredExternal.excludedGeometry.join(", ") || "non-product objects"}.`,
    };
  }

  if (answers.construction === "multi") {
    return {
      strategy: "multi-part",
      printedParts,
      sourcedComponents: inferredExternal.sourcedComponents,
      interfaces: ["Steckverbindung zwischen den Druckteilen: 0,5–0,7 mm Spiel und gerundete Einführfase"],
      assemblySteps: ["Teile getrennt drucken.", "Passflächen entgraten.", "Ohne Gewalt zusammenstecken und Funktion prüfen."],
      excludedGeometry: [...inferredExternal.excludedGeometry, ...commonExclusions],
      meshDirective: `Generate exactly ${printedParts.length} separate disconnected watertight printable solids as an exploded manufacturing kit. Place every part 12 mm apart, flat-side down, with matching keyed connections and 0.6 mm clearance. Never fuse, touch or overlap parts; exclude accessories: ${inferredExternal.excludedGeometry.join(", ") || "none"}.`,
    };
  }

  return {
    strategy: "single-part",
    printedParts,
    sourcedComponents: productKind === "planter" ? ["Pflanze, Erde und Wasser (keine Modellgeometrie)"] : inferredExternal.sourcedComponents,
    interfaces: ["Keine Montagepassung erforderlich; alle tragenden Bereiche bilden einen zusammenhängenden Körper"],
    assemblySteps: ["Als ein zusammenhängendes Teil drucken.", "Standfläche, Wandstärke und Oberfläche nach dem Druck prüfen."],
    excludedGeometry: [...(productKind === "planter" ? ["Pflanze", "Erde", "Wasser"] : inferredExternal.excludedGeometry), ...commonExclusions],
    meshDirective: `Generate exactly 1 coherent watertight printable solid with a flat stable build surface. No disconnected fragments, floating geometry, scene elements or accessories. Exclude: ${inferredExternal.excludedGeometry.join(", ") || "non-product objects"}.`,
  };
}

export function getDesignQuestions(templateId: string, answers: Record<string, string> = {}) {
  return templateId === "free-design" ? getFreeDesignQuestions(answers) : (blueprints[templateId] || genericBlueprint).questions;
}

export function buildDesignPlan(templateId: string, ideaInput: string, answerInput: Record<string, string> = {}): DesignPlan {
  const blueprint = templateId === "free-design" ? resolveFreeBlueprint(answerInput.product_purpose) : (blueprints[templateId] || genericBlueprint);
  const questions = getDesignQuestions(templateId, answerInput);
  const idea = ideaInput.trim().slice(0, 240);
  const sentenceIdea = idea.replace(/[.!?]+$/u, "");
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const selected = question.options.find((entry) => entry.value === answerInput[question.id]);
    if (selected) answers[question.id] = selected.value;
  }
  // Decoration-only lamps do not need a lighting-module decision.
  const lampFlow = templateId === "lamp" || (templateId === "free-design" && answers.product_purpose === "light");
  const relevantQuestions = lampFlow && answers.lamp_use === "decor"
    ? questions.filter((question) => question.id !== "lamp_module")
    : questions;
  const complete = idea.length >= 6 && relevantQuestions.every((question) => Boolean(answers[question.id]));
  const selectedLabels = relevantQuestions
    .map((question) => question.options.find((entry) => entry.value === answers[question.id])?.label)
    .filter(Boolean);
  const parts = blueprint.parts(answers);
  const manufacturing = buildManufacturingPlan(templateId, answers, parts, idea);
  const specifications = blueprint.specs(answers);
  const safetyNotes = blueprint.safety(answers);
  const productName = templateId === "free-design" && !answers.product_purpose ? "Deine eigene Idee" : blueprint.name;
  const summary = complete
    ? `${productName}: ${sentenceIdea}. ${selectedLabels.join(" · ")}.`
    : `${productName}: Wir klären nur die Produktentscheidungen, die für Funktion und 3D-Druck noch fehlen.`;
  const technicalBrief = [
    "[AB3D PRINT PLAN v2]",
    blueprint.mesh(idea || blueprint.name, answers),
    `Printable parts: ${parts.join("; ")}.`,
    `Sourced components, never print: ${manufacturing.sourcedComponents.join("; ") || "none"}.`,
    `Assembly: ${manufacturing.assemblySteps.join(" ")}`,
    `Non-negotiable construction requirements: ${specifications.join("; ")}.`,
    "Centered product assembly only, neutral background, no scene, no lettering, no logo.",
  ].join(" ");

  return {
    planVersion: "ab3d-print-plan-v2",
    templateId,
    productName,
    customerIdea: idea,
    intro: blueprint.intro,
    questions: relevantQuestions,
    answers,
    summary,
    parts,
    specifications,
    safetyNotes,
    manufacturing,
    technicalBrief,
    complete,
    requiresProductionReview: true,
  };
}

export function buildServerMeshPrompt(plan: DesignPlan, visual: { style?: string; surface?: string; colorMood?: string; printReady?: boolean }) {
  const visualDirection = [visual.style, visual.surface, visual.colorMood ? `material color direction: ${visual.colorMood}` : ""].filter(Boolean).join(", ");
  return [
    plan.manufacturing.meshDirective,
    `Design: ${plan.customerIdea.slice(0, 150)}.`,
    visualDirection ? `Style: ${visualDirection.slice(0, 90)}.` : "",
    visual.printReady ? "FDM-ready, manifold and self-supporting." : "",
  ].filter(Boolean).join(" ").slice(0, 600);
}
