---
name: Editorial Utility
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  h1:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  h2:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 20px
  container-max: 1280px
---

## Brand & Style

The design system is rooted in the **Corporate / Modern** aesthetic, prioritizing functional clarity and systematic order over decorative flair. The objective is to provide a "quiet" interface that recedes into the background, allowing the content of the blog post to remain the focal point. 

The personality is authoritative, reliable, and efficient. It utilizes a high-ratio of white space and a rigid structural grid to evoke the feeling of a high-end publishing tool. By combining a utilitarian layout with refined typographic scales, the design system creates an environment of focus for creators and administrators.

## Colors

The palette is anchored by a sophisticated range of **Neutral Grays (Slate)** to define the interface architecture. 
- **Primary (Indigo):** Reserved strictly for primary actions, active navigation states, and focus indicators.
- **Surface & Background:** A subtle distinction between the page background and content cards (using pure white) provides depth without relying on heavy shadows.
- **Utility Colors:** A clear red is utilized for the "Reset" and destructive actions to ensure user intent is deliberate.
- **Accents:** Secondary slate tones are used for borders and disabled states to maintain a low-noise environment.

## Typography

This design system employs a dual-font strategy to balance character with utility. 
- **Manrope** is used for headlines and section titles, providing a modern, geometric warmth that feels editorial.
- **Inter** is the workhorse for all UI elements, body copy, and data inputs, chosen for its exceptional legibility and systematic "screen-first" design. 

The type scale is strictly enforced to ensure visual hierarchy. Small caps are used for labels and category headers to provide a clear distinction from editable text.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid Grid**. The main workspace uses a 12-column system within a max-width container, while the sidebar navigation remains at a fixed width (280px). 

A strict 4px base unit (8px rhythm) governs all margins and padding. 
- **The Editor Workspace:** Uses generous 32px padding to simulate the physical margins of a document.
- **Panels & Sidebars:** Use 16px internal padding for density and efficiency.
- **Visual Grouping:** Elements related to the same section (e.g., Upload tools) use 8px spacing, while distinct sections (e.g., Preview vs. Controls) are separated by 24px or 32px.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Low-Contrast Outlines** rather than aggressive shadows.
- **Level 0 (Background):** The base canvas uses the background slate.
- **Level 1 (Surface):** White cards with a 1px solid border (#E2E8F0). No shadow.
- **Level 2 (Active/Interact):** A subtle, diffused shadow (0px 4px 6px -1px rgba(0, 0, 0, 0.1)) is used only for floating menus or active drag-over states in the Upload section.
- **Backdrop Blurs:** Used sparingly for modal overlays to keep the user's focus on the primary task.

## Shapes

The shape language is **Soft (0.25rem base)**. This ensures a professional, precise appearance that avoids the playfulness of fully rounded systems while remaining more approachable than sharp-edged brutalism.
- **Small Elements:** Buttons and Input fields use `rounded` (4px).
- **Large Containers:** The Preview area and Upload zones use `rounded-lg` (8px).
- **Indicators:** Tab underlines and focus rings utilize a 2px stroke width with squared-off or slightly softened caps.

## Components

### Navigation & Tabs
Tabs are critical for switching between **Background** and **Thumbnail** modes. The active state is indicated by a 2px Indigo bottom-border and a transition to the Primary color for text. Inactive tabs remain in a neutral slate.

### Upload Zone (Drag & Drop)
The upload component is a large-format dashed-border container.
- **Normal State:** Light gray background, centered icon, and instructional text.
- **Active (Drag-over):** Background shifts to a faint Indigo tint with a 2px Primary border.
- **Functionality:** Must include secondary "Click to browse" and "Paste link" text links for accessibility.

### Buttons
- **Primary:** Solid Indigo with White text.
- **Secondary (Preview):** Ghost style with a Slate-300 border.
- **Destructive (Reset):** Text-link style in Red, or an outlined red button to prevent accidental clicks.

### Input Fields
Inputs use a white background with a 1px border. On focus, the border transitions to Indigo with a subtle 2px outer glow (ring). Labels are always positioned above the input field using the `label-caps` typography style.

### Preview Card
The preview area is a read-only container that mimics the final live environment. It is visually distinguished by a slightly different background tone or a more pronounced border to separate "Creation" from "Viewing."