import {render,screen} from '@testing-library/react';
import ResearchDialog from './ResearchDialog';
test('new guide pages reset their content to the top while navigation stays outside the scrolling body',()=>{
 const content=key=><ResearchDialog paged scrollKey={key} title="Guide" onClose={jest.fn()}><section>Practice content</section><footer className="research-dialog-actions"><button>Next</button></footer></ResearchDialog>;
 const {rerender}=render(content(0));const body=screen.getByLabelText('Guide content');body.scrollTop=240;
 rerender(content(1));expect(body.scrollTop).toBe(0);expect(body).not.toContainElement(screen.getByRole('button',{name:'Next'}));
});
