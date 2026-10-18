import Image from "next/image";
import logo from "@/image.png";

export function BrandMark({ className }: { className: string }) {
  return <Image src={logo} alt="" className={className} width={36} height={30} />;
}
