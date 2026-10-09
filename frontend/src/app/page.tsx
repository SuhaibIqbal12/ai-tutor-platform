"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  ListChecks,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import Brand from "@/components/Brand";
import { getStoredToken } from "@/lib/api";
export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    if (getStoredToken())
      router.replace(
        localStorage.getItem("profile") ? "/dashboard" : "/onboarding",
      );
  }, [router]);
  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Brand />
        <Link href="/login" className="button-secondary">
          Open workspace <ArrowUpRight size={15} />
        </Link>
      </nav>
      <main>
        <section className="landing-hero">
          <div>
            <p className="eyebrow">YOUR MATERIAL. YOUR PACE.</p>
            <h1>
              Less searching.
              <br />
              More understanding.
            </h1>
            <p>
              A focused place for your study material, the questions that
              matter, and the practice that makes it stick.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/login" className="button-primary">
                Start learning <ArrowRight size={16} />
              </Link>
              <a href="#how-it-works" className="button-secondary">
                Take a closer look
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-5">
              Study, practice, and prepare — in one workspace.
            </p>
          </div>
          <div className="landing-example" aria-label="Example study workflow">
            <p className="example-label">
              A SMALL QUESTION. A BETTER UNDERSTANDING.
            </p>
            <div className="example-resource">
              <FileText size={27} strokeWidth={1.3} />
              <div>
                <strong>Your chapter on operating systems</strong>
                <small>Learning starts with the material you bring.</small>
              </div>
            </div>
            <div className="example-question">
              <div className="flex items-center gap-2 text-xs mb-4">
                <MessageSquare size={15} />A question worth exploring
              </div>
              <p>
                “Why does a process need its own address space? Help me
                understand it with an example.”
              </p>
              <small>Read → ask → connect → practice</small>
            </div>
            <div className="flex justify-between mt-6 text-xs">
              <span>Make the difficult parts click.</span>
              <ArrowUpRight size={16} />
            </div>
          </div>
        </section>
        <section className="landing-section" id="how-it-works">
          <p className="eyebrow">A THOUGHTFUL ROUTINE</p>
          <h2>From “I’ve read it” to “I understand it.”</h2>
          <div className="landing-features">
            {[
              {
                icon: BookOpen,
                title: "Keep your material together",
                text: "Add documents, notes and lecture links. See when your material is ready to study.",
              },
              {
                icon: MessageSquare,
                title: "Work through your questions",
                text: "Choose a subject or study from your library. Get explanations that meet you where you are.",
              },
              {
                icon: ListChecks,
                title: "Practice what you learn",
                text: "Test your understanding, revisit weaker topics, and build a routine with your study planner.",
              },
            ].map((item) => (
              <article key={item.title}>
                <item.icon
                  size={23}
                  strokeWidth={1.4}
                  className="text-primary"
                />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-section flex flex-wrap justify-between items-center gap-6">
          <div>
            <p className="eyebrow">BEYOND THE CHAPTER</p>
            <h2 className="mb-2!">Build skills for what comes next.</h2>
            <p className="text-sm text-muted-foreground">
              Coding practice, resume feedback and interview preparation.
            </p>
          </div>
          <Link href="/login" className="button-secondary">
            Explore your workspace <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <footer className="py-7 border-t border-border flex justify-between text-xs text-muted-foreground">
        <span>Tutor · Your learning workspace</span>
        <a href="#how-it-works">How it works</a>
      </footer>
    </div>
  );
}
