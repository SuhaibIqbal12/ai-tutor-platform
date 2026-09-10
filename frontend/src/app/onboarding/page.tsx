// frontend/src/app/onboarding/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Compass, Sparkles, BookOpen, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
import { getStoredToken, apiRequest } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Profile Form States
  const [academicYear, setAcademicYear] = useState("1st Year");
  const [branch, setBranch] = useState("Computer Science");
  const [cgpa, setCgpa] = useState("");
  const [strongSubjects, setStrongSubjects] = useState("");
  const [weakSubjects, setWeakSubjects] = useState("");
  const [learningPref, setLearningPref] = useState("Analogy-driven (metaphors, examples)");
  const [careerInterests, setCareerInterests] = useState("");

  useEffect(() => {
    // If not logged in, redirect
    if (!getStoredToken()) {
      router.replace("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const strongArr = strongSubjects.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    const weakArr = weakSubjects.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    const careerArr = careerInterests.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

    const profileBody = {
      academicYear,
      branch,
      cgpa: parseFloat(cgpa) || 7.0,
      strongSubjects: strongArr,
      weakSubjects: weakArr,
      learningPreferences: [learningPref],
      careerInterests: careerArr,
    };

    try {
      const data = await apiRequest("/api/auth/profile", "POST", profileBody);
      if (data.status === "success" && data.data.profile) {
        localStorage.setItem("profile", JSON.stringify(profileDataTransformer(data.data.profile)));
        // Dispatch custom event to notify Navbar of new profile values
        window.dispatchEvent(new Event("profileUpdated"));
        router.replace("/dashboard");
      }
    } catch (err: any) {
      alert("Failed to submit onboarding profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize subjects/interests that might return as arrays or stringified arrays
  const profileDataTransformer = (profile: any) => {
    const transform = (val: any): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
        return val.split(",").map((s) => s.trim()).filter(Boolean);
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
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-slate-950 px-4 py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-650/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-xl w-full space-y-8 bg-slate-900/60 backdrop-blur-md p-8 sm:p-10 rounded-2xl border border-slate-800 shadow-2xl z-10">
        <div className="text-center">
          <div className="inline-flex p-3 bg-secondary/80 rounded-xl border border-border/40 mb-3">
            <Compass className="h-7 w-7 text-indigo-400 animate-spin-slow" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Configure Your AI Tutor</h2>
          <p className="mt-2 text-xs text-slate-400 font-medium max-w-sm mx-auto">
            Create your academic fingerprint so the RAG models can customize explanation difficulty
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* STEP 1: Basic academic status */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Step 1: Academic Status</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                    Branch / Major
                  </label>
                  <input
                    type="text"
                    required
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs focus:outline-none transition-colors shadow-inner"
                    placeholder="e.g. Computer Science, Physics"
                  />
                </div>

                <div>
                  <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                    Academic Year
                  </label>
                  <select
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 rounded-xl transition-colors"
                  >
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                    <option>Graduate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                  Current Cumulative GPA (CGPA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs focus:outline-none transition-colors shadow-inner"
                  placeholder="e.g. 8.4"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-white text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Subject Mastery Profile */}
          {step === 2 && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Step 2: Subject Mastery Profile</h3>

              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                  Strong Subjects (comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={strongSubjects}
                  onChange={(e) => setStrongSubjects(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs focus:outline-none transition-colors shadow-inner"
                  placeholder="Data Structures, Calculus, Mechanics"
                />
              </div>

              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Weak Subjects (comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={weakSubjects}
                  onChange={(e) => setWeakSubjects(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs focus:outline-none transition-colors shadow-inner"
                  placeholder="Compiler Design, Probability, Electromagnetism"
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-750 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-white text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Career Goals & Styles */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Step 3: Goals & Learning Style</h3>

              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                  Learning Style Style Preference
                </label>
                <select
                  value={learningPref}
                  onChange={(e) => setLearningPref(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 rounded-xl transition-colors"
                >
                  <option>Analogy-driven (metaphors, examples)</option>
                  <option>Technical/Rigor (formulaic, proofs)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Career Interests (comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={careerInterests}
                  onChange={(e) => setCareerInterests(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs focus:outline-none transition-colors shadow-inner"
                  placeholder="Machine Learning Engineer, Full-Stack Developer"
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-750 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow hover:from-indigo-500 hover:to-emerald-450 transition-all duration-200 cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Saving profile..." : "Save and Launch workspace"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
