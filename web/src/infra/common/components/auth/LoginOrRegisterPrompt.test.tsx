import React from 'react';
import { LoginOrRegisterPrompt } from './LoginOrRegisterPrompt';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';

Enzyme.configure({ adapter: new Adapter() });

/**
 * Objective 2 (UI half): a login/register form backed by the sqlite
 * credentials API.
 */
describe('LoginOrRegisterPrompt', () => {
  let onLoginMock: jest.Mock;
  let onRegisterMock: jest.Mock;
  let wrapper: Enzyme.ReactWrapper;

  beforeEach(() => {
    onLoginMock = jest.fn();
    onRegisterMock = jest.fn();
    wrapper = Enzyme.mount(
      <LoginOrRegisterPrompt onLogin={onLoginMock} onRegister={onRegisterMock} />,
    );
  });

  function fillIn(nickname: string, password: string) {
    const inputs = wrapper.find('input');
    inputs.at(0).simulate('change', { target: { value: nickname } });
    inputs.at(1).simulate('change', { target: { value: password } });
  }

  function buttonWithText(text: string) {
    return wrapper.find(Button).filterWhere((b) => b.text().includes(text));
  }

  it('renders both a nickname and a password field', () => {
    const inputs = wrapper.find('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(inputs.at(1).prop('type')).toEqual('password');
  });

  it('calls onLogin with the entered credentials', () => {
    fillIn('alice', 'password1234');
    buttonWithText('Log In').simulate('click');
    expect(onLoginMock).toHaveBeenCalledWith({
      nickname: 'alice',
      password: 'password1234',
    });
  });

  it('calls onRegister with the entered credentials', () => {
    fillIn('bob', 'password1234');
    buttonWithText('Register').simulate('click');
    expect(onRegisterMock).toHaveBeenCalledWith({
      nickname: 'bob',
      password: 'password1234',
    });
  });

  it('does not submit with an empty nickname', () => {
    fillIn('', 'password1234');
    buttonWithText('Log In').simulate('click');
    expect(onLoginMock).not.toHaveBeenCalled();
  });

  it('does not submit with a too-short password', () => {
    fillIn('carol', 'abc');
    buttonWithText('Register').simulate('click');
    expect(onRegisterMock).not.toHaveBeenCalled();
  });

  it('shows an error returned by the server', () => {
    wrapper.setProps({ errorText: 'Invalid nickname or password.' });
    wrapper.update();
    expect(wrapper.html()).toContain('Invalid nickname or password.');
  });

  it('shows a progress indicator while submitting', () => {
    wrapper.setProps({ loading: true });
    wrapper.update();
    expect(wrapper.find(CircularProgress).length).toBeGreaterThan(0);
  });
});
