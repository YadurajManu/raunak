import Image from "next/image";
import logo from "@/image.png";
import "./brand-mark.css";

export function BrandMark({ className }: { className: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <Image src={logo} alt="" className="brand-mark-light" width={36} height={30} />
      <Image src="/brand/mark-dark.png" alt="" className="brand-mark-dark" width={36} height={30} />
    </span>
  );
}
