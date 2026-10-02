import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScheduleWeekView } from './ScheduleWeekView';
import type { AcademicEntry, AcademicSchedule } from '../utils/academicSchedule';

const entry = (section: number, changes: Partial<AcademicEntry> = {}): AcademicEntry => ({section,day_index:5,period:6,subject_id:'course',subject_name:'Programming For Cyber-Security',instructor_id:null,instructor_name:'Abeer',kind:'lecture',week_pattern:0,room:'G203',uses_rotation:false,lab_room:'',hall_room:'',lab_week:1,...changes});
const schedule = (entries: AcademicEntry[]): AcademicSchedule => ({department:'cybersecurity',academic_year:'2',can_edit:false,student_section:'1',settings:{semester_start:null,week_start_day:5,start_time:'09:00:00',days_off:[4,6]},entries,subjects:[{id:'course',name:'Programming For Cyber-Security'}],instructors:[]});
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container=document.createElement('div');document.body.append(container);root=createRoot(container); });
afterEach(async () => { await act(async () => root.unmount());container.remove(); });
function Harness({data,student=true}: {data:AcademicSchedule;student?:boolean}) {
  const [view,setView]=useState(student?'mine':'all');const [cycle,setCycle]=useState('1');
  return <ScheduleWeekView data={data} student={student} section={1} view={view} date="2026-10-02" cycle={Number(cycle)} actualWeek={null} previewCycle={cycle} onView={setView} onCycle={setCycle} onSection={()=>{}} onDate={()=>{}} />;
}
async function click(label: string) {
  const button=[...container.querySelectorAll('button')].find(button=>button.textContent?.trim()===label);
  expect(button,`button ${label}`).toBeDefined();await act(async()=>button!.click());
}
describe('Student timetable display', () => {
  it('opens own section, switches to all sections and combines a shared lecture without duplicate cards',async()=>{
    await act(async()=>root.render(<Harness data={schedule([entry(1),entry(2)])}/>));
    expect(container.querySelectorAll('article')).toHaveLength(1);expect(container.textContent).toContain('جدول سكشن 1');
    await click('كل السكاشن');expect(container.querySelectorAll('article')).toHaveLength(1);expect(container.textContent).toContain('السكاشن: 1، 2');
    expect(container.textContent).toContain('2:00 م');expect(container.textContent).toContain('3:00 م');
    expect(container.textContent).not.toMatch(/Excel|week1|week2|استيراد/);
  });
  it('shows the correct alternating place and keeps different venues separate',async()=>{
    await act(async()=>root.render(<Harness data={schedule([entry(1,{kind:'section',room:'A02',week_pattern:1}),entry(1,{kind:'section',room:'G203',week_pattern:2}),entry(2,{room:'D105'})])}/>));
    expect(container.textContent).toContain('A02');expect(container.textContent).not.toContain('G203');
    await click('الثاني');expect(container.textContent).toContain('G203');expect(container.textContent).not.toContain('A02');
    await click('كل السكاشن');expect(container.querySelectorAll('article')).toHaveLength(2);
  });
  it('marks days off and shows a useful empty day rather than displaying stored lessons',async()=>{
    await act(async()=>root.render(<Harness data={schedule([entry(1),entry(1,{day_index:6})])}/>));
    const saturday=[...container.querySelectorAll('button')].find(button=>button.textContent?.startsWith('السبت'))!;
    await act(async()=>saturday.click());expect(container.textContent).toContain('إجازة حسب الجدول المعتمد.');expect(container.querySelectorAll('article')).toHaveLength(0);
  });
  it('does not invent a section for an unassigned student and explains the unpublished state',async()=>{
    await act(async()=>root.render(<Harness data={{...schedule([]),student_section:null}}/>));
    expect(container.textContent).toContain('لم يُحدد سكشن حسابك بعد');expect(container.textContent).toContain('الجدول لم يُنشر بعد');
  });
});
