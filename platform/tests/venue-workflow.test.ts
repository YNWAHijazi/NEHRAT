import {describe,it,expect} from 'vitest';
import {venueRequirements,venuePackageEditable} from '../lib/rules/venue-workflow';
import type {Level} from '../lib/rules';
describe('venue submission requirements',()=>{
 for(const level of [1,2,3] as Level[])it(`starts pending at level ${level}; every item needs a recorded answer`,()=>{
  const rows=venueRequirements(level,{},new Set());expect(rows.length).toBeGreaterThan(0);expect(rows.every(r=>r.fields.length>0&&!r.done)).toBe(true);expect(rows.some(r=>r.n===19)).toBe(false);
 });
 it('makes the Level 2 plan recommended and Level 3 signed plan required',()=>{
  expect(venueRequirements(1,{},new Set()).find(r=>r.n===2)).toBeUndefined();
  const two=venueRequirements(2,{},new Set()).find(r=>r.n===2)!;expect(two.optional).toBe(true);expect(two.fields.map(f=>f.key)).not.toContain('approvedBy');
  const three=venueRequirements(3,{'2':{preparedBy:'EMS',approvedBy:'Director licence 123'}},new Set()).find(r=>r.n===2)!;expect(three.optional).toBe(false);expect(three.done).toBe(false);
  expect(venueRequirements(3,{'2':{preparedBy:'EMS',approvedBy:'Director licence 123'}},new Set(['2'])).find(r=>r.n===2)?.done).toBe(true);
 });
 it('does not mistake one answer or a file alone for completed arrangements',()=>{
  expect(venueRequirements(2,{'1':{name:'Manager'}},new Set(['1'])).find(r=>r.n===1)?.done).toBe(false);
  expect(venueRequirements(2,{'1':{name:'Manager',phone:'+9611234567'}},new Set()).find(r=>r.n===1)?.done).toBe(true);
 });
 it('uses linked identities instead of asking medical partners to enter them again',()=>{
  const rows=venueRequirements(3,{},new Set());
  expect(rows.find(r=>r.n===7)!.fields.filter(f=>!f.source).map(f=>f.key)).toEqual(['arrangements']);
  expect(rows.find(r=>r.n===5)!.fields.filter(f=>!f.source).map(f=>f.key)).toEqual(['teams']);
  expect(rows.find(r=>r.n===2)!.fields.filter(f=>!f.source)).toEqual([]);
  expect(rows.find(r=>r.n===20)!.fields.filter(f=>!f.source)).toEqual([]);
 });
 it('locks filed, accepted and archived packages',()=>{
  expect(venuePackageEditable('draft',false)).toBe(true);expect(venuePackageEditable('revision',false)).toBe(true);
  expect(venuePackageEditable('submitted',false)).toBe(false);expect(venuePackageEditable('accepted',false)).toBe(false);expect(venuePackageEditable('draft',true)).toBe(false);
 });
});
