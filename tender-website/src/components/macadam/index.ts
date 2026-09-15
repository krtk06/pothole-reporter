export { default as Ground } from "./Ground";
export { default as MeshField } from "./MeshField";
export { default as SandField } from "./SandField";
export { default as SandHero } from "./SandHero";
export { default as Spotlight } from "./Spotlight";

export { Surface } from "./Surface";
export type { SurfaceProps } from "./Surface";

export { Pill } from "./Pill";
export type { PillProps, PillTone } from "./Pill";

export { Input, Textarea, Select, Field } from "./Field";
export type { FieldProps } from "./Field";

export { Reveal } from "./Reveal";
export type { RevealProps } from "./Reveal";

export { Counter } from "./Counter";
export type { CounterProps } from "./Counter";

export { MagneticButton } from "./MagneticButton";
export type { MagneticButtonProps, ButtonVariant } from "./MagneticButton";

export { Ignition } from "./Ignition";
export type { IgnitionProps } from "./Ignition";

export { ThemeToggle } from "./ThemeToggle";
export type { ThemeToggleProps } from "./ThemeToggle";

export { NavBar, NavInner, NavSpacer } from "./Nav";

export { Logo } from "./Logo";
export type { LogoProps } from "./Logo";

/* MapSkin is intentionally NOT re-exported here: it imports leaflet at module
   scope. Import it directly from "@/components/macadam/MapSkin" inside
   components that are loaded client-side only (dynamic + ssr: false). */
export type { PinStatus, StatusIconOptions } from "./MapSkin";

export { useTheme } from "./useTheme";
export { applyTheme, readTheme, themeInitScript, THEME_KEY, THEME_EVENT } from "./theme";
export type { Theme } from "./theme";

export {
  durations,
  easeOut,
  easeInOut,
  springSoft,
  springSnappy,
  magneticSpring,
  stagger,
  fadeUp,
  fadeUpGroup,
  prefersReducedMotion,
} from "./motion";
