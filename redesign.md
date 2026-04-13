# Design System Strategy: CRM Intelligence Editorial

 

## 1. Overview & Creative North Star

This design system is built to transform the standard utility of a CRM into a high-end, editorial experience. We are moving away from the "data-heavy dashboard" trope and toward a **"Digital Curator"** philosophy. 

 

The North Star of this system is to present AI-driven insights with the weight and clarity of a premium financial journal. We achieve this by balancing the "vibrant soul" of the purple and blue brand palette against expansive white space and sophisticated, asymmetric layouts. This isn't just a tool; it’s a high-performance environment where intelligence is felt through depth, soft geometry, and intentional typography.

 

---

 

## 2. Colors & Surface Philosophy

The palette utilizes deep purples (`primary: #460E74`) and vibrant accents (`secondary: #8127CF`) to drive action, set against a multi-tiered neutral foundation.

 

### The "No-Line" Rule

To maintain a premium feel, **1px solid borders are strictly prohibited** for sectioning or containment. Structural boundaries must be defined solely through:

*   **Background Shifts:** Placing a `surface_container_low` card on a `surface` background.

*   **Tonal Transitions:** Using slight variations in color value to imply edges.

 

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers. Use the following hierarchy to "nest" importance:

1.  **Canvas:** `background` (#F9F9FF)

2.  **Primary Sectioning:** `surface_container_low` (#F0F3FF)

3.  **Actionable Cards:** `surface_container_lowest` (#FFFFFF) — This creates a natural "lift" against the slightly darker container.

4.  **Floating Elements:** Use Glassmorphism (Semi-transparent `surface_variant` with 20px Backdrop Blur) for floating menus or AI insights.

 

### Signature Textures

Apply a subtle linear gradient to primary buttons and hero metric cards:

*   **Direction:** 135 degrees.

*   **From:** `primary` (#460E74) to `primary_container` (#5E2C8C).

This adds a "visual soul" that differentiates the product from flat, generic SaaS templates.

 

---

 

## 3. Typography

We utilize a dual-typeface system to bridge the gap between "Efficient Tech" and "Authoritative Editorial."

 

*   **Display & Headlines (Manrope):** Chosen for its modern, geometric character. Used for large data points and page titles to convey confidence and clarity.

    *   *Scale Example:* `display-lg` (3.5rem) for high-level "Hero Metrics."

*   **UI & Body (Inter):** A workhorse for readability. Inter handles the dense CRM data, list items, and labels without visual fatigue.

    *   *Scale Example:* `body-md` (0.875rem) for general lead details.

 

**The Editorial Scale:** Use significant contrast between headline sizes and body text. A large `headline-lg` paired with a quiet `label-md` creates an intentional, curated look.

 

---

 

## 4. Elevation & Depth

Depth in this system is achieved through **Tonal Layering** rather than traditional drop shadows.

 

*   **Ambient Shadows:** For elements that must float (Modals, Hovered Cards), use an "Ambient Light" shadow:

    *   *Blur:* 40px - 60px.

    *   *Color:* `on_surface` (#151C27) at 4% to 6% opacity.

*   **The Ghost Border:** If a boundary is required for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.

*   **Glassmorphism:** Navigation rails and tooltips should use semi-transparent `surface_container_lowest` (80% opacity) with a `blur(12px)` to allow the brand colors of the dashboard to bleed through softly.

 

---

 

## 5. Components

 

### Buttons & Chips

*   **Primary Button:** Uses the Signature Gradient (`primary` to `primary_container`) with `rounded-md` (0.75rem). Text is always `on_primary`.

*   **Secondary/Action Chips:** Use `secondary_container` with `on_secondary_fixed_variant` text.

*   **Shapes:** All interactive elements must follow the `md` (0.75rem) or `lg` (1rem) roundedness scale to maintain the "Soft AI" vibe.

 

### Metric Cards

*   **Layout:** Asymmetric. Place the "Label" in `label-md` at the top left, the "Big Number" in `display-sm` (Manrope) in the center, and a subtle icon in a `secondary_container` background in the corner.

*   **Container:** `surface_container_lowest` (#FFFFFF) on a `surface_container` background. **No borders.**

 

### List Items & Tables

*   **Constraint:** Forbid the use of horizontal divider lines. 

*   **Separation:** Use vertical white space (16px - 24px) or a soft hover state change to `surface_container_high`.

*   **Leading Elements:** Use circular avatars or `rounded-sm` icons to keep the interface approachable.

 

### Input Fields

*   **Resting State:** `surface_container_low` background with a `Ghost Border`.

*   **Focus State:** Smooth transition to a 2px `primary` bottom-border only, or a subtle glow using `primary` at 10% opacity.

 

---

 

## 6. Do’s and Don’ts

 

### Do

*   **Do** use extreme white space to separate lead categories.

*   **Do** use `primary_fixed` (#F0DBFF) for subtle highlights in "AI Suggestions."

*   **Do** ensure all "High-Quality Typography" uses proper line-height (1.5x for body text).

*   **Do** use `surface_bright` for tooltips to make them pop against deep purple backgrounds.

 

### Don’t

*   **Don't** use 100% black text; always use `on_surface` (#151C27) for a softer, premium contrast.

*   **Don't** use sharp 90-degree corners; they conflict with the "User-Friendly" persona.

*   **Don't** use "Drop Shadows" that are dark or tight. If a shadow doesn't look like natural ambient light, remove it.

*   **Don't** clutter the navigation. Use the `tertiary` tokens for inactive states to keep the focus on the active `primary` dashboard items.
