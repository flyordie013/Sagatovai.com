import { getDashboard } from "@/data/dashboard";
import { Hero } from "@/components/dashboard/hero";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import { CourseGrid } from "@/components/dashboard/course-grid";
import { AiMentorCard } from "@/components/dashboard/ai-mentor-card";
import { LevelCard } from "@/components/dashboard/level-card";
import { MissionCard } from "@/components/dashboard/mission-card";

export default async function DashboardPage() {
  const data = await getDashboard();
  const progressPct =
    data.totalLessons > 0
      ? Math.round((data.completedLessons / data.totalLessons) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <Hero />

      <StatsStrip
        progressPct={progressPct}
        completed={data.completedLessons}
        total={data.totalLessons}
        achievements={data.achievementsUnlocked}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
        <CourseGrid courses={data.courses} />

        <aside className="space-y-4">
          <AiMentorCard />
          <LevelCard user={data.user} />
          <MissionCard mission={data.mission} />
        </aside>
      </div>
    </div>
  );
}
