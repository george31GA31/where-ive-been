const test=require('node:test'),assert=require('node:assert/strict');
const UI=require('../journey-presentation.js');
test('Counts use singular only for one, including imported numeric strings',()=>{
  for(const word of ['day','stay','night']){
    assert.equal(UI.count(1,word),'1 '+word);assert.equal(UI.count('1',word),'1 '+word);
    assert.equal(UI.count(0,word),'0 '+word+'s');assert.equal(UI.count(2,word),'2 '+word+'s');
  }
});
test('Readable ranges retain years across month and year boundaries',()=>{
  assert.equal(UI.range('2025-07-26','2025-07-27'),'26 - 27 Jul 2025');
  assert.equal(UI.range('2026-09-18T23:00','2026-09-18T09:00'),'18 Sep 2026');
  assert.equal(UI.range('2026-09-30','2026-10-02'),'30 Sep - 2 Oct 2026');
  assert.equal(UI.range('2026-12-31','2027-01-02'),'31 Dec 2026 - 2 Jan 2027');
});
test('Missing and invalid dates never expose ISO or invalid-date strings',()=>{
  assert.equal(UI.date('2026-02-30'),'');assert.equal(UI.date('unavailable'),'');
  assert.equal(UI.range(null,null),'Date not recorded');assert.equal(UI.range(null,'2026-10-04'),'4 Oct 2026');
});
test('Stay nights use calendar dates through daylight-saving transitions',()=>{
  assert.equal(UI.nights('2026-03-28','2026-03-30'),2);
  assert.equal(UI.nights('2026-10-24','2026-10-25'),1);
  assert.equal(UI.nights('2026-10-24','2026-10-24'),0);
  assert.equal(UI.nights('2026-10-25','2026-10-24'),null);assert.equal(UI.nights('',''),null);
});
