import Image from "next/image";

const LOGO_ASPECT = 504 / 612;

export function SaraLogo({ size = 24 }: { size?: number }) {
  const width = size;
  const height = Math.round(size * LOGO_ASPECT);

  return (
    <Image
      src="/sara-ambient-agent-logo-light-no-bg.png"
      alt="SARA"
      width={width}
      height={height}
      style={{ objectFit: "contain", display: "block" }}
      priority
    />
  );
}
