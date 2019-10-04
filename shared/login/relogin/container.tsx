import * as React from 'react'
import * as LoginGen from '../../actions/login-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import HiddenString from '../../util/hidden-string'
import Login from '.'
import {sortBy} from 'lodash-es'
import * as Container from '../../util/container'
import flags from '../../util/feature-flags'
import * as ConfigTypes from '../../constants/types/config'

type OwnProps = {resetSuccess: boolean}

type Props = {
  error: string
  loggedInMap: Map<string, boolean>
  onFeedback: () => void
  onForgotPassword: (username: string) => void
  onLogin: (user: string, password: string) => void
  onSignup: () => void
  onSomeoneElse: () => void
  resetBannerUser: string | null
  selectedUser: string
  users: Array<ConfigTypes.ConfiguredAccount>
}

const LoginWrapper = (props: Props) => {
  const [password, setPassword] = React.useState('')
  const [selectedUser, setSelectedUser] = React.useState(props.selectedUser)
  const [showTyping, setShowTyping] = React.useState(false)

  const prevPassword = Container.usePrevious(password)
  const prevError = Container.usePrevious(props.error)

  const dispatch = Container.useDispatch()

  const {onLogin, loggedInMap} = props

  const onSubmit = React.useCallback(() => {
    onLogin(selectedUser, password)
  }, [selectedUser, password, onLogin])

  const selectedUserChange = React.useCallback(
    user => {
      dispatch(LoginGen.createLoginError({error: null}))
      setPassword('')
      setSelectedUser(user)
      if (loggedInMap.get(user)) {
        onLogin(user, '')
      }
    },
    [dispatch, setPassword, setSelectedUser, onLogin, loggedInMap]
  )

  // Effects
  React.useEffect(() => {
    if (!prevError && !!props.error) {
      setPassword('')
    }
  }, [prevError, props.error, setPassword])
  React.useEffect(() => {
    setSelectedUser(props.selectedUser)
  }, [props.selectedUser, setSelectedUser])
  React.useEffect(() => {
    if (!prevPassword && !!password) {
      dispatch(LoginGen.createLoginError({error: null}))
    }
  }, [password, prevPassword, dispatch])

  return (
    <Login
      error={props.error}
      onFeedback={props.onFeedback}
      onForgotPassword={() => props.onForgotPassword(selectedUser)}
      onLogin={onLogin}
      onSignup={props.onSignup}
      onSomeoneElse={props.onSomeoneElse}
      onSubmit={onSubmit}
      password={password}
      passwordChange={setPassword}
      resetBannerUser={props.resetBannerUser}
      selectedUser={selectedUser}
      selectedUserChange={selectedUserChange}
      showTypingChange={setShowTyping}
      showTyping={showTyping}
      users={props.users}
    />
  )
}

export default Container.connect(
  (state: Container.TypedState) => ({
    _users: state.config.configuredAccounts,
    _autoresetUser: state.autoreset.username,
    error: state.login.error,
    selectedUser: state.config.defaultUsername,
  }),
  dispatch => ({
    _onForgotPassword: (username: string) =>
      flags.resetPipeline
        ? dispatch(RecoverPasswordGen.createStartRecoverPassword({username}))
        : dispatch(LoginGen.createLaunchForgotPasswordWebPage()),
    onFeedback: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']})),
    onLogin: (username: string, password: string) =>
      dispatch(LoginGen.createLogin({password: new HiddenString(password), username})),
    onSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
    onSomeoneElse: () => dispatch(ProvisionGen.createStartProvision()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    error: (stateProps.error && stateProps.error.desc) || '',
    loggedInMap: new Map<string, boolean>(
      stateProps._users.map(account => [account.username, account.hasStoredSecret])
    ),
    onFeedback: dispatchProps.onFeedback,
    onForgotPassword: dispatchProps._onForgotPassword,
    onLogin: dispatchProps.onLogin,
    onSignup: dispatchProps.onSignup,
    onSomeoneElse: dispatchProps.onSomeoneElse,
    resetBannerUser: ownProps.resetSuccess ? stateProps._autoresetUser : null,
    selectedUser: ownProps.resetSuccess ? stateProps._autoresetUser : stateProps.selectedUser,
    users: sortBy(stateProps._users, 'username'),
  })
)(LoginWrapper)
