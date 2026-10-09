// frontend/src/app/onboarding/page.tsx
"use client";
import { useNotice } from "@/components/NoticeProvider";
import { errorMessage } from "@/lib/contracts";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Brand from "@/components/Brand";
import { getStoredToken, apiRequest } from "@/lib/api";

export default function OnboardingPage() {
  const notify = useNotice();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Profile Form States
  const [academicYear, setAcademicYear] = useState("1st Year");
  const [branch, setBranch] = useState("Computer Science");
  const [cgpa, setCgpa] = useState("");
  const [strongSubjects, setStrongSubjects] = useState("");
  const [weakSubjects, setWeakSubjects] = useState("");
  const [learningPref, setLearningPref] = useState(
    "Analogy-driven (metaphors, examples)",
  );
  const [careerInterests, setCareerInterests] = useState("");

  useEffect(() => {
    // If not logged in, redirect
    if (!getStoredToken()) {
      router.replace("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setLoading(true);

    const strongArr = strongSubjects
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const weakArr = weakSubjects
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const careerArr = careerInterests
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const profileBody = {
      academicYear,
      branch,
      cgpa: Number(cgpa),
      strongSubjects: strongArr,
      weakSubjects: weakArr,
      learningPreferences: [learningPref],
      careerInterests: careerArr,
    };

    try {
      const data = await apiRequest("/api/auth/profile", "POST", profileBody);
      if (data.status === "success" && data.data.profile) {
        localStorage.setItem(
          "profile",
          JSON.stringify(profileDataTransformer(data.data.profile)),
        );
        // Dispatch custom event to notify Navbar of new profile values
        window.dispatchEvent(new Event("profileUpdated"));
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      notify("Failed to submit onboarding profile: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize subjects/interests that might return as arrays or stringified arrays
  const profileDataTransformer = (profile: Record<string, unknown>) => {
    const transform = (val: unknown): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    return {
      ...profile,
      strongSubjects: transform(profile.strongSubjects),
      weakSubjects: transform(profile.weakSubjects),
      learningPreferences: transform(profile.learningPreferences),
      careerInterests: transform(profile.careerInterests),
    };
  };

  return (
    <div className="min-h-screen bg-background px-5 py-8">
      <div className="max-w-2xl mx-auto">
        <Brand />
        <section className="panel mt-10 p-6 sm:p-10">
          <p className="eyebrow">LET’S MAKE THIS YOURS · STEP {step} OF 3</p>
          <h1 className="text-3xl font-medium tracking-tight mt-3 mb-3">
            {step === 1
              ? "A little about your studies."
              : step === 2
                ? "What feels easy? What doesn’t?"
                : "Where would you like to go?"}
          </h1>
          <p className="text-sm text-muted-foreground mb-7">
            {step === 1
              ? "This helps your tutor choose the right level of explanation."
              : step === 2
                ? "Tell us what to build on and what deserves another look."
                : "Choose the explanation style and goals that fit you."}
          </p>
          <div className="flex gap-2 mb-8" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1 rounded-full flex-1 ${n <= step ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <label htmlFor="branch" className="field-label">
                  Course or major
                </label>
                <input
                  id="branch"
                  className="field"
                  required
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Computer Science"
                />
                <div className="grid sm:grid-cols-2 gap-x-5">
                  <div>
                    <label htmlFor="year" className="field-label">
                      Academic year
                    </label>
                    <select
                      id="year"
                      className="field"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                    >
                      {[
                        "1st Year",
                        "2nd Year",
                        "3rd Year",
                        "4th Year",
                        "Graduate",
                      ].map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cgpa" className="field-label">
                      CGPA (out of 10)
                    </label>
                    <input
                      id="cgpa"
                      className="field"
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      required
                      value={cgpa}
                      onChange={(e) => setCgpa(e.target.value)}
                      placeholder="e.g. 8.2"
                    />
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <label htmlFor="strengths" className="field-label">
                  Subjects you’re comfortable with
                </label>
                <textarea
                  id="strengths"
                  className="field h-24!"
                  value={strongSubjects}
                  onChange={(e) => setStrongSubjects(e.target.value)}
                  placeholder="Python, mathematics, databases"
                />
                <label htmlFor="weaknesses" className="field-label">
                  Subjects you’d like help with
                </label>
                <textarea
                  id="weaknesses"
                  className="field h-24!"
                  value={weakSubjects}
                  onChange={(e) => setWeakSubjects(e.target.value)}
                  placeholder="Data structures, operating systems"
                />
                <p className="field-hint">
                  Separate subjects with commas. You can leave either field
                  empty.
                </p>
              </>
            )}
            {step === 3 && (
              <>
                <label htmlFor="preference" className="field-label">
                  How do you like things explained?
                </label>
                <select
                  id="preference"
                  className="field"
                  value={learningPref}
                  onChange={(e) => setLearningPref(e.target.value)}
                >
                  {[
                    "Analogy-driven (metaphors, examples)",
                    "Technical/Rigor (formulaic, proofs)",
                    "Visual (diagrams, mind maps)",
                    "Step-by-step (detailed explanations)",
                    "Practical (code, hands-on examples)",
                  ].map((pref) => (
                    <option key={pref}>{pref}</option>
                  ))}
                </select>
                <label htmlFor="interests" className="field-label">
                  Career interests or goals
                </label>
                <textarea
                  id="interests"
                  className="field h-24!"
                  value={careerInterests}
                  onChange={(e) => setCareerInterests(e.target.value)}
                  placeholder="Backend development, machine learning, interview preparation"
                />
                <p className="field-hint">
                  Separate interests with commas. It’s fine if you’re still
                  exploring.
                </p>
              </>
            )}
            <div className="mt-9 flex justify-between items-center gap-4">
              {step > 1 ? (
                <button
                  type="button"
                  disabled={loading}
                  className="button-secondary"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  A few details. A better starting point.
                </span>
              )}
              <button
                type="submit"
                disabled={loading}
                className="button-primary"
              >
                {loading ? "Saving…" : step < 3 ? "Continue" : "Open workspace"}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
