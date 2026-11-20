import React from 'react';
import {act,fireEvent,render,screen,within} from '@testing-library/react';
import {ModeChoice,ClarificationChoices,FollowTopicDialog} from './ResearchFlow';
import TopicInbox from './TopicInbox';
import RecentUpdates from './RecentUpdates';
import FeedbackInbox from './FeedbackInbox';
import {apiFetch} from '../utils/api';
jest.mock('../utils/api',()=>({...jest.requireActual('../utils/api'),apiFetch:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
test('research directions wait for a selection without a request or timer-driven advance',()=>{
 const choose=jest.fn();render(<ModeChoice onChoose={choose} />);
 expect(choose).not.toHaveBeenCalled();expect(apiFetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/Explore AEI online/}));expect(choose).toHaveBeenCalledWith('aei');
 fireEvent.click(screen.getByRole('button',{name:/Explore the wider web/}));expect(choose).toHaveBeenLastCalledWith('web');
 expect(screen.getByText(/Choose a direction, review the question/)).toBeVisible();expect(screen.queryByText(/No automatic switch or search/)).not.toBeInTheDocument();expect(apiFetch).not.toHaveBeenCalled();
});
test('clarification offers real library leads and a custom direction without sending an AI question',()=>{
 const choose=jest.fn(),custom=jest.fn();render(<ClarificationChoices clarification={{options:[{label:'Broadband and local access',question:'Explain Broadband and local access.'}]}} onChoose={choose} onCustom={custom} />);
 fireEvent.click(screen.getByRole('radio',{name:'Broadband and local access'}));fireEvent.click(screen.getByRole('button',{name:'Use this direction'}));expect(choose).toHaveBeenCalledWith('Explain Broadband and local access.');
 fireEvent.change(screen.getByRole('textbox',{name:'Another direction'}),{target:{value:'Remote clinics'}});fireEvent.click(screen.getByRole('button',{name:'Use this direction'}));expect(custom).toHaveBeenCalledWith('Remote clinics');expect(apiFetch).not.toHaveBeenCalled();
});
test('following requires a visible source-scope choice and saves only the chat reference and scope',async()=>{
 apiFetch.mockResolvedValue({ok:true,json:async()=>({saved:true})});const saved=jest.fn();render(<FollowTopicDialog chatId="private-chat" onClose={jest.fn()} onSaved={saved} />);
 expect(screen.getByText(/24 hours/)).toBeVisible();fireEvent.click(screen.getByRole('radio',{name:'AEI online'}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Follow topic',exact:true})));
 expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({chatId:'private-chat',scope:'aei'});expect(saved).toHaveBeenCalledTimes(1);
});
test('an inbox item asks for a mode before opening its original conversation',()=>{
 const open=jest.fn();render(<TopicInbox topics={[{id:'topic',title:'Local connectivity',chatId:'chat-one',topic:'Rural connectivity',scope:'library',updates:[{title:'New article',url:'https://www.aei.org/article/',kind:'library',foundAt:'2026-11-19',excerpt:'A passage.'}]}]} onRefresh={jest.fn()} onCheck={jest.fn()} onOpen={open} />);
 fireEvent.click(screen.getByRole('button',{name:'Discuss in chat'}));expect(open).not.toHaveBeenCalled();const dialog=within(screen.getByRole('dialog',{name:'Choose how to discuss this update'}));
 fireEvent.click(dialog.getByRole('radio',{name:'Wider web'}));fireEvent.click(dialog.getByRole('button',{name:'Open question in chat'}));expect(open.mock.calls[0][2]).toBe('web');expect(open.mock.calls[0][0].chatId).toBe('chat-one');
});
test('release updates have user-controlled steps and link back to the full guided demo',()=>{
 const tour=jest.fn();render(<RecentUpdates onClose={jest.fn()} onTour={tour} />);
 expect(screen.getByRole('heading',{name:'Find additional AEI perspectives'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Next',exact:true}));expect(screen.getByRole('heading',{name:'Add outside evidence'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Open full guided demo'}));expect(tour).toHaveBeenCalledTimes(1);expect(apiFetch).not.toHaveBeenCalled();
});
test('staff reports retain their new indicator until explicitly marked read',async()=>{
 apiFetch.mockImplementation(async(url)=>url.includes('/read')?{ok:true}:{ok:true,json:async()=>({reports:[{id:'report',category:'Missing context',reporterLabel:'Demo User 1',createdAt:'2026-11-19',detail:'Check the topic.',answer:'Reported answer.',read:false}]})});
 const read=jest.fn();render(<FeedbackInbox onRead={read} />);expect(await screen.findByText('New')).toBeVisible();await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Mark report read'})));expect(screen.queryByText('New')).not.toBeInTheDocument();expect(read).toHaveBeenCalledTimes(1);
});
