import {useState} from 'react';
import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {ScheduleForm} from './ScheduleForm';
vi.mock('../../../shared/hooks/useFormatters',()=>({useFormatters:()=>({timezone:'Europe/Moscow'})}));
describe('ScheduleForm',()=>{
 it('displays and saves dates in the stated timezone',()=>{
  const onUpdate=vi.fn();
  render(<ScheduleForm initialStartsAt="2026-10-01T09:00:00Z" onUpdate={onUpdate}/>);
  expect(screen.getByLabelText('Начало голосования')).toHaveValue('2026-10-01T12:00');
  fireEvent.change(screen.getByLabelText('Окончание голосования'),{target:{value:'2026-10-01T14:00'}});
  expect(onUpdate).toHaveBeenCalledWith({starts_at:'2026-10-01T09:00:00Z',ends_at:'2026-10-01T11:00:00.000Z'});
 });
 it('reports reversed dates and allows clearing an optional date',()=>{
  function Form(){const [range,setRange]=useState({starts_at:'2026-10-01T09:00:00Z' as string|null,ends_at:'2026-10-01T08:00:00Z' as string|null});return <ScheduleForm initialStartsAt={range.starts_at} initialEndsAt={range.ends_at} onUpdate={setRange}/>;}
  render(<Form/>);
  expect(screen.getByLabelText('Окончание голосования')).toHaveAttribute('aria-invalid','true');
  expect(screen.getByText('Окончание должно быть позже начала.')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Окончание голосования'),{target:{value:''}});
  expect(screen.getByLabelText('Окончание голосования')).toHaveValue('');
  expect(screen.queryByText('Окончание должно быть позже начала.')).toBeNull();
 });
});
