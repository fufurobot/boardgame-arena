import React from 'react';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import CardContent from '@material-ui/core/CardContent';
import TextField from '@material-ui/core/TextField';
import Card from '@material-ui/core/Card';
import CircularProgress from '@material-ui/core/CircularProgress';
import AlertLayer from '../alert/AlertLayer';

/** Matches the server-side constraint in UsersService. */
const MIN_PASSWORD_LENGTH = 8;
const VALID_NICKNAME_REGEX = /^[A-Za-z0-9_]*$/;

export interface Credentials {
  nickname: string;
  password: string;
}

interface Props {
  onLogin: (credentials: Credentials) => void;
  onRegister: (credentials: Credentials) => void;
  /** Error reported by the server, e.g. a rejected login. */
  errorText?: string;
  loading?: boolean;
  onChange?: () => void;
}

interface State {
  nickname: string;
  password: string;
}

/**
 * Login/register form for the sqlite-backed credential API.
 *
 * Both actions submit the same two fields; the user picks whether the
 * account already exists.
 */
export class LoginOrRegisterPrompt extends React.Component<Props, State> {
  state: State = { nickname: '', password: '' };

  render() {
    if (this.props.loading) {
      return (
        <AlertLayer>
          <Card style={styles.card}>
            <CardContent>
              <CircularProgress />
            </CardContent>
          </Card>
        </AlertLayer>
      );
    }

    const { errorText } = this.props;

    return (
      <AlertLayer>
        <Card style={styles.card}>
          <Typography style={{ paddingTop: '16px' }} variant="h5" component="h3">
            Log In or Register
          </Typography>
          <CardContent>
            <div>
              <TextField
                autoFocus={true}
                type="text"
                label="Nickname"
                value={this.state.nickname}
                onChange={this._onNicknameChange}
                onKeyPress={this._submitOnEnter}
                error={!!errorText}
                helperText={!!this.state.nickname && !this._nicknameIsValid() ? 'Alphanumerical characters only' : undefined}
                inputProps={{ maxLength: 15 }}
              />
            </div>
            <div>
              <TextField
                type="password"
                label="Password"
                value={this.state.password}
                onChange={this._onPasswordChange}
                onKeyPress={this._submitOnEnter}
                error={!!errorText}
                helperText={errorText}
                inputProps={{ minLength: MIN_PASSWORD_LENGTH }}
              />
            </div>
            <Button
              variant="contained"
              color="primary"
              style={styles.button}
              onClick={this._login}
              disabled={!this._isValid()}
            >
              Log In
            </Button>
            <Button
              variant="contained"
              style={styles.button}
              onClick={this._register}
              disabled={!this._isValid()}
            >
              Register
            </Button>
          </CardContent>
        </Card>
      </AlertLayer>
    );
  }

  _nicknameIsValid = () =>
    this.state.nickname.length > 0 &&
    VALID_NICKNAME_REGEX.test(this.state.nickname);

  _passwordIsValid = () => this.state.password.length >= MIN_PASSWORD_LENGTH;

  _isValid = () => this._nicknameIsValid() && this._passwordIsValid();

  _credentials = (): Credentials => ({
    nickname: this.state.nickname,
    password: this.state.password,
  });

  _login = () => {
    if (this._isValid()) {
      this.props.onLogin(this._credentials());
    }
  };

  _register = () => {
    if (this._isValid()) {
      this.props.onRegister(this._credentials());
    }
  };

  _submitOnEnter = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      this._login();
    }
  };

  _onNicknameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ nickname: event.target.value }, this._notifyChange);
  };

  _onPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ password: event.target.value }, this._notifyChange);
  };

  _notifyChange = () => {
    if (this.props.onChange) this.props.onChange();
  };
}

const styles = {
  card: {
    marginTop: '16px',
    whiteSpace: 'nowrap' as const,
    width: '300px',
    marginLeft: 'auto',
    marginRight: 'auto',
    textAlign: 'center' as const,
  },
  button: {
    marginTop: '16px',
    marginLeft: '4px',
    marginRight: '4px',
  },
};
