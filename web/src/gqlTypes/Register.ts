/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { CredentialsInput } from "./globalTypes";

// ====================================================
// GraphQL mutation operation: Register
// ====================================================

export interface Register_register {
  __typename: "NewUser";
  jwtToken: string;
}

export interface Register {
  register: Register_register;
}

export interface RegisterVariables {
  credentials: CredentialsInput;
}
