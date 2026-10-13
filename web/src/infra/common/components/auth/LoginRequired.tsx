import React, { ReactNode } from 'react';
import { LoginOrRegisterPrompt, Credentials } from './LoginOrRegisterPrompt';
import { LobbyService } from '../../services/LobbyService';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import FreeBoardGamesBar from 'infra/common/components/base/FreeBoardGamesBar';
import { ReduxState, ReduxUserState } from 'infra/common/redux/definitions';
import { compose } from 'recompose';

interface InnerProps {
  dispatch: Dispatch;
  user: ReduxUserState;
}

interface OutterProps {
  onSuccess?: (...args: any) => void;
  children: ReactNode;
  renderAsPopup?: boolean;
  skipFbgBar?: boolean;
}

interface State {
  errorText: string;
  loading: boolean;
}

/**
 * Requires an authenticated user, showing the login/register form otherwise.
 *
 * This is the credential-backed counterpart to NicknameRequired, which only
 * collected a nickname and could not prove identity.
 */
export class LoginRequired extends React.Component<InnerProps & OutterProps, State> {
  state: State = { errorText: undefined, loading: false };

  async componentDidMount() {
    this.props.dispatch(LobbyService.getSyncUserAction());
  }

  render() {
    const nickname: string = this.props.user.nickname;
    if (nickname) {
      return this.props.children;
    }

    const prompt = (
      <LoginOrRegisterPrompt
        onLogin={this._login}
        onRegister={this._register}
        errorText={this.state.errorText}
        loading={this.state.loading}
        onChange={this._clearError}
      />
    );

    if (this.props.renderAsPopup) {
      return (
        <React.Fragment>
          {prompt}
          {this.props.children}
        </React.Fragment>
      );
    } else if (this.props.skipFbgBar) {
      return prompt;
    }
    return <FreeBoardGamesBar>{prompt}</FreeBoardGamesBar>;
  }

  _clearError = () => this.setState({ errorText: undefined });

  _login = async (credentials: Credentials) => {
    await this._submit(() => LobbyService.login(credentials.nickname, credentials.password));
  };

  _register = async (credentials: Credentials) => {
    await this._submit(() => LobbyService.register(credentials.nickname, credentials.password));
  };

  _submit = async (action: () => Promise<string>) => {
    this.setState({ loading: true, errorText: undefined });
    try {
      await action();
      this.props.dispatch(LobbyService.getSyncUserAction());
      if (this.props.onSuccess) this.props.onSuccess();
    } catch (e) {
      const errorText = e.response?.body?.message || e.message || 'Unknown error';
      this.setState({ errorText });
    } finally {
      this.setState({ loading: false });
    }
  };
}

/* istanbul ignore next */
const mapStateToProps = function (state: ReduxState) {
  return {
    user: { ...state.user },
  };
};

export default compose<InnerProps, OutterProps>(connect(mapStateToProps))(LoginRequired);
