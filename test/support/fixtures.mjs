export function documents() {
  return {
    dataset:{schemaVersion:'1',domain:'enterprise',version:'17.0',sourceUrl:'https://attack.mitre.org/',techniques:[
      {id:'T0001',parentId:null,revoked:false,deprecated:false,tactics:['execution','discovery']},
      {id:'T0001.001',parentId:'T0001',revoked:false,deprecated:false,tactics:['execution']},
      {id:'T0002',parentId:null,revoked:true,deprecated:false,tactics:['execution']},
      {id:'T0003',parentId:null,revoked:false,deprecated:true,tactics:['execution']}]},
    activities:{schemaVersion:'1',inventoryComplete:true,sourceNotes:[
      {ref:'private-note-a',available:true,note:'PRIVATE_NOTE_SENTINEL'},
      {ref:'private-note-b',available:true}],activities:[
      {sourceNoteRef:'private-note-a',techniqueIds:['T0001'],tactic:'execution',detection:'detected'},
      {sourceNoteRef:'private-note-b',techniqueIds:['T0001.001'],detection:'detected'}]}
  }
}
export function datasetWith(n) {
  const {dataset}=documents()
  dataset.techniques=Array.from({length:n},(_,i)=>({id:`T${String(i).padStart(4,'0')}`,parentId:null,revoked:false,deprecated:false,tactics:['execution']}))
  return dataset
}
export function activitiesWith(n) {
  const {activities}=documents()
  activities.activities=Array.from({length:n},()=>({...activities.activities[0],techniqueIds:['T0001']}))
  return activities
}
