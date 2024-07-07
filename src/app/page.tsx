import { Hero, Proposition, CTA } from "@/modules/home";

export default function Home() {
  return (
    <div className="bg-slate-50 grainy-light">
      <Hero />
      <Proposition />
      <CTA />
    </div>
  );
}
