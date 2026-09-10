export function missionState(m,now=Date.now()){
 if(!m.active)return 'inactive';
 const date=typeof m.deadlineAt==='string'?Date.parse(m.deadlineAt):NaN;
 if(!Number.isFinite(date))return 'undated';
 return date<=now?'expired':'active';
}
export function selectMissions(missions,f={},now=Date.now()){return missions.filter(m=>(!f.municipality||(m.municipalityId||'__missing')===f.municipality)&&(!f.coordinator||m.assignedTo===f.coordinator)&&(!f.state||missionState(m,now)===f.state));}
export function summarizeMissions(missions,now=Date.now()){const counts={active:0,expired:0,inactive:0,undated:0};for(const m of missions)counts[missionState(m,now)]++;return counts;}
