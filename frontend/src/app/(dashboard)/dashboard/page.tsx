"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ListChecks,
  MessageSquare,
  CalendarDays,
  Code2,
  RefreshCw,
  Activity,
  Target,
  Flame,
  Library,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";
import { errorMessage } from "@/lib/contracts";
interface DnaData {
  learningStyle: string;
  currentLevel: string;
  retentionRate: number;
  studyConsistency: number;
  confidenceLevel: number;
  learningVelocity: number;
  codingGrowthScore: number;
  placementReadiness: number;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  learningCoins: number;
  badges: string[];
}

interface AnalyticsData {
  streak: number;
  averageScore: number;
  masteredCount: number;
  documentsCount: number;
  dna: DnaData;
  aiFeedback: string;
  quizHistoryChart: { name: string; score: number }[];
  skillGrowthChart: { subject: string; A: number }[];
}

const bounded = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div className="progress-row">
      <div className="progress-row-label">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {Math.round(bounded(value))}%
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={bounded(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="progress-fill"
          style={{ width: `${bounded(value)}%` }}
        />
      </div>
    </div>
  );
}
export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("/api/analytics/dashboard");
      if (res.status !== "success" || !res.data)
        throw new Error("We couldn't load your activity.");
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  const metrics = [
    {
      label: "Study resources",
      value: data?.documentsCount,
      foot: "Material in your library",
      icon: Library,
    },
    {
      label: "Average quiz score",
      value: data ? `${Math.round(data.averageScore)}%` : undefined,
      foot: "Across completed attempts",
      icon: ListChecks,
    },
    {
      label: "Topics mastered",
      value: data?.masteredCount,
      foot: "Based on quiz evaluations",
      icon: Target,
    },
    {
      label: "Current streak",
      value: data ? `${data.streak || data.dna.currentStreak} days` : undefined,
      foot: "Keep building your routine",
      icon: Flame,
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="A little progress, every day."
        description="Pick up where you left off, or make room for something new."
        action={
          <Link className="button-secondary" href="/sources">
            <BookOpen size={15} /> Add material
          </Link>
        }
      />
      <section className="study-banner">
        <div>
          <p className="eyebrow">A GOOD PLACE TO START</p>
          <h2>Turn a question into understanding.</h2>
          <p>
            Bring your study material, ask a question, and work through it at
            your own pace.
          </p>
        </div>
        <Link className="button-primary shrink-0" href="/tutor">
          Open your tutor <ArrowRight size={16} />
        </Link>
      </section>
      <div className="stat-grid">
        {metrics.map((m) => (
          <section className="panel metric" key={m.label}>
            <div className="metric-label">
              <span>{m.label}</span>
              <m.icon size={15} />
            </div>
            <strong
              className={`metric-value ${loading ? "animate-pulse" : ""}`}
            >
              {loading ? "—" : (m.value ?? "—")}
            </strong>
            <p className="metric-foot">{m.foot}</p>
          </section>
        ))}
      </div>
      {error && (
        <div
          role="alert"
          className="auth-error flex items-center justify-between gap-4"
        >
          <span>{error}</span>
          <button className="button-secondary shrink-0" onClick={load}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Your practice over time</h2>
                <p>Scores from your last ten quiz attempts</p>
              </div>
              <Link
                href="/quizzes"
                className="text-xs text-primary flex items-center gap-1"
              >
                Practice <ArrowUpRight size={13} />
              </Link>
            </div>
            {loading ? (
              <div className="empty-state animate-pulse">
                Loading your activity…
              </div>
            ) : data?.quizHistoryChart?.length ? (
              <div
                className="chart-grid"
                role="list"
                aria-label="Recent quiz scores"
              >
                {data.quizHistoryChart.map((q, i) => (
                  <div
                    className="chart-column"
                    key={i}
                    role="listitem"
                    aria-label={`${q.name || `Quiz ${i + 1}`}: ${q.score}%`}
                  >
                    <div
                      className="chart-bar"
                      style={{ height: `${bounded(q.score)}%` }}
                      title={`${q.name}: ${q.score}%`}
                    />
                    <small>{Math.round(q.score)}%</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Activity size={27} />
                <strong>Your progress starts with practice.</strong>
                <p>Complete a quiz to see your scores here.</p>
                <Link href="/quizzes" className="button-secondary">
                  Take your first quiz <ArrowRight size={14} />
                </Link>
              </div>
            )}
            <p className="text-xs text-muted-foreground px-6 py-4 border-t border-border mt-5">
              Every attempt is a chance to see what needs another look.
            </p>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>What you’re learning</h2>
                <p>Topic mastery from your quiz evaluations</p>
              </div>
              <Target size={17} className="text-muted-foreground" />
            </div>
            {data?.skillGrowthChart?.length ? (
              <div className="pb-5">
                {data.skillGrowthChart.map((skill) => (
                  <Progress
                    key={skill.subject}
                    label={skill.subject}
                    value={skill.A}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No topics to show yet.</strong>
                <p>Your completed quizzes will build this picture.</p>
              </div>
            )}
          </section>
        </div>
        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Choose your next step</h2>
                <p>A focused session goes a long way.</p>
              </div>
            </div>
            {[
              {
                href: "/sources",
                title: "Build your library",
                sub: "Add notes, chapters or a lecture",
                icon: BookOpen,
              },
              {
                href: "/tutor",
                title: "Work through a question",
                sub: "Learn with explanations and examples",
                icon: MessageSquare,
              },
              {
                href: "/coding",
                title: "Practice your code",
                sub: "Solve a challenge and get feedback",
                icon: Code2,
              },
              {
                href: "/planner",
                title: "Make a study plan",
                sub: "Give your next week some structure",
                icon: CalendarDays,
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="quick-action">
                <item.icon size={19} />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.sub}</small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Learning notes</h2>
                <p>Feedback based on your recent activity</p>
              </div>
            </div>
            <p className="px-6 pb-6 text-sm text-muted-foreground leading-7">
              {data?.aiFeedback ||
                "Complete a few practice sessions to start receiving feedback on what to revisit."}
            </p>
          </section>
          {data && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Your learning profile</h2>
                  <p>
                    {data.dna.currentLevel} · {data.dna.learningStyle}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Level {data.dna.level}
                </span>
              </div>
              <Progress
                label="Study consistency"
                value={data.dna.studyConsistency}
              />
              <Progress
                label="Retention estimate"
                value={data.dna.retentionRate}
              />
              <Progress
                label="Confidence estimate"
                value={data.dna.confidenceLevel}
              />
              <Progress
                label="Career readiness estimate"
                value={data.dna.placementReadiness}
              />
              <Progress
                label="Coding growth estimate"
                value={data.dna.codingGrowthScore}
              />
              <p className="text-xs text-muted-foreground px-6 py-4">
                These are learning signals, not measured outcomes.
              </p>
              <div className="border-t border-border px-6 py-4 flex gap-5 text-xs text-muted-foreground">
                <span>{data.dna.xp} XP</span>
                <span>{data.dna.learningCoins} coins</span>
                <span>{data.dna.learningVelocity}× velocity</span>
              </div>
              {data.dna.badges?.length > 0 && (
                <div className="px-6 pb-5 flex flex-wrap gap-2">
                  {data.dna.badges.map((b) => (
                    <span
                      key={b}
                      className="bg-secondary text-xs px-2 py-1 rounded"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
