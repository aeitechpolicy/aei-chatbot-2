import {act,fireEvent,render,screen} from '@testing-library/react';
import ChatInterface from './ChatInterface';
import {apiFetch} from '../utils/api';
jest.mock('../utils/api',()=>({...jest.requireActual('../utils/api'),apiFetch:jest.fn()}));
test('research controls wait for the answer end and reset when a new response arrives',async()=>{
 const observed=[];const original=global.IntersectionObserver;
 global.IntersectionObserver=class{constructor(callback){this.callback=callback;observed.push(this);}observe(){}disconnect(){}};
 HTMLElement.prototype.scrollIntoView=jest.fn();
 const initial={id:'sample-chat',domainName:'General',messages:[{role:'user',content:'A public sample question.'},{role:'assistant',content:'A newly written sample answer.'}]};
 apiFetch.mockResolvedValue({ok:true,json:async()=>initial});
 const send=jest.fn().mockResolvedValue({response:'A second newly written answer.',chat:{...initial,messages:[...initial.messages,{role:'user',content:'Another sample question.'},{role:'assistant',content:'A second newly written answer.'}]}});
 try {
  render(<ChatInterface active chatId="sample-chat" draftScope="General" onScopeChange={jest.fn()} onSendMessage={send} />);
  expect(await screen.findByText('A newly written sample answer.')).toBeVisible();
  expect(screen.queryByRole('region',{name:'Choose the next research step'})).not.toBeInTheDocument();
  act(()=>observed.at(-1).callback([{isIntersecting:true}]));
  expect(screen.getByRole('region',{name:'Choose the next research step'})).toBeVisible();
  fireEvent.change(screen.getByRole('textbox',{name:'Ask about the scholars’ work'}),{target:{value:'Another sample question.'}});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Send message'})));
  expect(screen.getByText('A second newly written answer.')).toBeVisible();
  expect(screen.queryByRole('region',{name:'Choose the next research step'})).not.toBeInTheDocument();
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({behavior:'auto',block:'start'});
  act(()=>observed.at(-1).callback([{isIntersecting:true}]));
  expect(screen.getByRole('region',{name:'Choose the next research step'})).toBeVisible();
 }finally{global.IntersectionObserver=original;}
});
