# Immo-Helper

Immo-Helper ist ein Tool, was mich bei meiner Suche nach Wohnungen auf https://www.immobilienscout24.de/ unterstützt.

## Vorteile

- **Kategorisierung:** Markiere Wohnungen als "interessant", "vielleicht" oder "uninteressant".
- **Übersichtlichkeit:** Intuitive und strukturierte Darstellung der Suchergebnisse.
- **Zusammenarbeit:** Suche gemeinsam mit Freunden oder Partnern nach Wohnungen.
- **[Geplant] Frontend:** Webansicht für alle hinzugefügten Wohnungen um spezielle Informationen zu verwalten.

![vorher-nachher.png](vorher-nachher.png)

## Installation

### Backend

1. Repository klonen:
    ```bash
    git clone https://github.com/LeTammo/immohelper.git
    ```
2. Abhängigkeiten installieren und Server starten:
    ```bash
    cd immohelper/backend
    npm install
    npm start
    ```

### Browser-Script

1. Die Browser-Erweiterung [Tampermonkey](https://www.tampermonkey.net/) installieren.
2. `browser-script.js` in Tampermonkey einfügen.
3. Die Konstante `username` im Script anpassen
4. ggf. '@connect' in der Tampermonkey-Script-Header anpassen.
5. Script speichern und aktivieren.

### Frontend

Noch nicht implementiert.