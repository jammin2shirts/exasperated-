const features = [
  {
    title: "Salary & Tax Calculator",
    description:
      "See exactly what your paycheck looks like after state income taxes when you move. Compare take-home pay side-by-side across all 50 states.",
    icon: "💰",
    href: "/calculator",
  },
  {
    title: "Best Places to Live",
    description:
      "Discover top cities and towns ranked by employment opportunities, affordability, and quality of life so you can find your perfect fit.",
    icon: "🏡",
    href: "/places",
  },
  {
    title: "K-12 School Comparison",
    description:
      "Get an accurate picture of public school quality in any state. Compare graduation rates, test scores, and per-pupil spending with where you live now.",
    icon: "🎒",
    href: "/schools",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Moving Assistant
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Everything you need to make a confident move — salary &amp; tax
          comparisons, top places to live, and school system rankings all in one
          place.
        </p>
        <a
          href="/calculator"
          className="mt-8 inline-flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Get Started
        </a>
      </section>

      {/* Feature Cards */}
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 pb-24 sm:grid-cols-3">
        {features.map((feature) => (
          <a
            key={feature.href}
            href={feature.href}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="text-3xl">{feature.icon}</span>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {feature.title}
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {feature.description}
            </p>
          </a>
        ))}
      </section>
    </main>
  );
}
