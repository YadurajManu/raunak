import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/public/checkout-form";
export default function CheckoutPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CheckoutForm eventId="checkout-fixture" eventSlug="checkout-fixture" buyerName="Sample attendee" buyerEmail="attendee@example.test" types={[{id:"early-bird",name:"Garba Early Bird Pass",minPerOrder:1,maxPerOrder:10}]} cashfreeMode="sandbox" whatsappAvailable event={{title:"Garba Night · Sample preview",startsAt:"2027-10-20T12:30:00Z",timezone:"Asia/Kolkata",venueName:"Community Hall",city:"Ahmedabad",refundPolicy:"Refunds available until 48 hours before the event."}} />;
}
