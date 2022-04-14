import { Formik } from "formik";
import { useSession } from "next-auth/react";
import PropTypes from "prop-types";
import React, { useState } from "react";

import Form from "./Form";

function IndividualRegistrationForm({
  defaultErrorMessage,
  fields,
  onSubmit,
  submitUrl,
}) {
  const { data: session } = useSession();
  const [status, setStatus] = useState({});

  const getAccountDetails = async () => {
    const {
      accessToken,
      user: {
        profile: { id },
      },
    } = session;

    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    });
    const response = await fetch(`/api/accounts/profile/${id}`, {
      method: "GET",
      headers,
    });
    const responseJson = await response.json();
    return responseJson;
  };

  return (
    <Formik
      initialValues={getAccountDetails().then((profile) => {
        return {
          firstName: `${profile.first_name}`,
          lastName: `${profile.last_name}`,
          location: `${profile.location}`,
          bio: `${profile.bio}`,
          phoneNumber: `${profile.phone_number}`,
          socialMedia: `${profile.social_media_link}`,
        };
      })}
      validate={(values) => {
        const errors = {};
        if (!values.firstName) {
          errors.firstName = fields?.firstName?.error;
        }
        if (!values.lastName) {
          errors.lastName = fields?.lastName?.error;
        }
        if (!values.location) {
          errors.location = fields?.location?.error;
        }
        if (!values.bio) {
          errors.bio = fields?.bio?.error;
        }
        if (!values.phoneNumber) {
          errors.phoneNumber = fields?.phoneNumber?.error;
        }
        if (!values.socialMedia) {
          errors.socialMedia = fields?.socialMedia?.error;
        }
        return errors;
      }}
      onSubmit={async (
        { firstName, lastName, bio, location, phoneNumber, socialMedia },
        { setErrors, setSubmitting }
      ) => {
        const body = {
          first_name: firstName,
          last_name: lastName,
          bio,
          location,
          phone_number: phoneNumber,
          social_media_link: socialMedia,
        };
        if (submitUrl) {
          const {
            accessToken,
            user: {
              profile: { id },
            },
          } = session;
          try {
            const headers = new Headers({
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${accessToken}`,
            });
            const response = await fetch(`/api/accounts/profile/${id}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(body),
            });
            const responseJson = await response.json();
            if (response.status === 201) {
              setStatus({ children: undefined });
              if (onSubmit) {
                onSubmit();
              }
            } else {
              setErrors(responseJson);
              setStatus({ error: true, children: "Error" });
            }
          } catch (e) {
            setStatus({ error: true, children: "Error" });
          } finally {
            setSubmitting(false);
          }
        } else {
          setStatus({ error: true, children: defaultErrorMessage });
        }
      }}
    >
      {({ submitForm, isSubmitting, errors }) => (
        <Form
          disabled={isSubmitting}
          errors={errors}
          status={status}
          fields={fields}
          onSubmit={submitForm}
        />
      )}
    </Formik>
  );
}

IndividualRegistrationForm.propTypes = {
  defaultErrorMessage: PropTypes.string,
  fields: PropTypes.shape({
    firstName: PropTypes.shape({ error: PropTypes.string }),
    lastName: PropTypes.shape({ error: PropTypes.string }),
    location: PropTypes.shape({ error: PropTypes.string }),
    bio: PropTypes.shape({ error: PropTypes.string }),
    phoneNumber: PropTypes.shape({ error: PropTypes.string }),
    socialMedia: PropTypes.shape({ error: PropTypes.string }),
  }),
  onSubmit: PropTypes.func,
  submitUrl: PropTypes.string,
};

IndividualRegistrationForm.defaultProps = {
  defaultErrorMessage: undefined,
  fields: undefined,
  onSubmit: false,
  submitUrl: undefined,
};

export default IndividualRegistrationForm;
