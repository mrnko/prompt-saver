import { BarChart3 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeriodStats, Stats } from '../types';

function Metric({ label, value }: { label: string; value: PeriodStats }) { return <div className="metric"><span>{label}</span><strong>{value.created}</strong><small>{value.completed} виконано</small></div>; }
export function Analytics({ stats }: { stats: Stats }) {
  return <section className="analytics card"><div className="section-heading"><div><p className="eyebrow">АНАЛІТИКА</p><h2>Ваш ритм роботи</h2></div><BarChart3 size={21}/></div><div className="metrics"><Metric label="Сьогодні" value={stats.today}/><Metric label="Учора" value={stats.yesterday}/><Metric label="7 днів" value={stats.week}/><Metric label="30 днів" value={stats.month}/></div><div className="chart"><ResponsiveContainer width="100%" height={184}><LineChart data={stats.daily} margin={{ top: 8, right: 5, left: -25, bottom: 0 }}><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8da0b8' }} interval={4} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8da0b8' }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e3ebf6', boxShadow: '0 8px 20px #2463aa18' }}/><Line type="monotone" dataKey="created" name="Створено" stroke="#1677ff" strokeWidth={2.5} dot={false}/><Line type="monotone" dataKey="completed" name="Виконано" stroke="#20a366" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div></section>;
}
