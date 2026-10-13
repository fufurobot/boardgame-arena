/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { CredentialsInput } from "./globalTypes";

// ====================================================
// GraphQL mutation operation: Login
// ====================================================

export interface Login_login {
  __typename: "NewUser";
  jwtToken: string;
}

export interface Login {
  login: Login_login;
}

export interface LoginVariables {
  credentials: CredentialsInput;
}
