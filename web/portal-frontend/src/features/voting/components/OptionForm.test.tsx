import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {OptionForm} from './OptionForm';
it('only notifies the parent when the user edits a field',()=>{
 const change=vi.fn();
 const {rerender}=render(<OptionForm initialData={{title:'Minecraft'}} onChange={value=>change(value)}/>);
 rerender(<OptionForm initialData={{title:'Minecraft'}} onChange={value=>change(value)}/>);
 expect(change).not.toHaveBeenCalled();
 fireEvent.change(screen.getByPlaceholderText('Например: Project Zeta'),{target:{value:'Deep Rock'}});
 expect(change).toHaveBeenCalledOnce();
 expect(change).toHaveBeenLastCalledWith(expect.objectContaining({title:'Deep Rock'}));
});
