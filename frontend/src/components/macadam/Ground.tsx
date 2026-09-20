/**
 * The shared ground: near-flat page tint plus film grain. Mounted once,
 * behind all content, on both portals. Decoration lives in photography —
 * the ground stays quiet in both themes.
 */
export default function Ground() {
  return (
    <div className="macadam-ground" aria-hidden>
      <div className="grain-layer" />
    </div>
  );
}
