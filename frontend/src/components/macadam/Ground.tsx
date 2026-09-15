import MeshField from "./MeshField";
import SandField from "./SandField";
import Spotlight from "./Spotlight";

/**
 * The shared ground: mesh gradient, sand aggregate, pointer spotlight, grain.
 * Mounted once, behind all content, on both portals.
 */
export default function Ground() {
  return (
    <div className="macadam-ground" aria-hidden>
      <MeshField />
      <SandField />
      <Spotlight />
      <div className="grain-layer" />
    </div>
  );
}
