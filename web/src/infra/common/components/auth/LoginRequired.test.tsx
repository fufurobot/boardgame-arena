import React from 'react';
import { LoginRequired } from './LoginRequired';
import Enzyme from 'enzyme';
import { LobbyService } from '../../services/LobbyService';

jest.mock('../../services/LobbyService');

/**
 * Objective 2 (UI wiring): the login/register form must actually call the
 * credential API and update the session.
 */
describe('Login Required', () => {
  let wrapper: Enzyme.ReactWrapper;
  let mockDispatch: jest.Mock;
  let onSuccessMock: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    mockDispatch = jest.fn();
    onSuccessMock = jest.fn();
    const Connected: any = LoginRequired;
    wrapper = Enzyme.mount(
      <Connected user={{}} dispatch={mockDispatch} onSuccess={onSuccessMock}>
        <p>secret content</p>
      </Connected>,
    );
  });

  it('renders the prompt and hides children when logged out', () => {
    expect(wrapper.text()).toContain('Log In');
    expect(wrapper.text()).not.toContain('secret content');
  });

  it('shows children when already logged in', () => {
    const Connected: any = LoginRequired;
    const loggedIn = Enzyme.mount(
      <Connected user={{ nickname: 'alice', loggedIn: true, ready: true }} dispatch={mockDispatch}>
        <p>secret content</p>
      </Connected>,
    );
    expect(loggedIn.text()).toContain('secret content');
  });

  it('calls LobbyService.login with the submitted credentials', async () => {
    (LobbyService.login as jest.Mock).mockResolvedValue('token');
    const instance: any = wrapper.instance();
    await instance._login({ nickname: 'alice', password: 'password1234' });
    expect(LobbyService.login).toHaveBeenCalledWith('alice', 'password1234');
    expect(onSuccessMock).toHaveBeenCalled();
  });

  it('calls LobbyService.register with the submitted credentials', async () => {
    (LobbyService.register as jest.Mock).mockResolvedValue('token');
    const instance: any = wrapper.instance();
    await instance._register({ nickname: 'bob', password: 'password1234' });
    expect(LobbyService.register).toHaveBeenCalledWith('bob', 'password1234');
    expect(onSuccessMock).toHaveBeenCalled();
  });

  it('surfaces an error message when login fails', async () => {
    (LobbyService.login as jest.Mock).mockRejectedValue(new Error('Invalid nickname or password.'));
    const instance: any = wrapper.instance();
    await instance._login({ nickname: 'alice', password: 'wrongpassword' });
    wrapper.update();
    expect(wrapper.state('errorText')).toEqual('Invalid nickname or password.');
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  it('clears the loading flag after a failed attempt', async () => {
    (LobbyService.login as jest.Mock).mockRejectedValue(new Error('nope'));
    const instance: any = wrapper.instance();
    await instance._login({ nickname: 'alice', password: 'wrongpassword' });
    expect(wrapper.state('loading')).toEqual(false);
  });
});
