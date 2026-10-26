import { Instrument_Serif } from "next/font/google";
import "./checkout.css";
import { RouteFooter } from "@/components/marketing/footer";

const display = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <div className={`checkout-shell ${display.variable}`}>{children}<RouteFooter pathname="/checkout/[slug]" /></div>;
}
