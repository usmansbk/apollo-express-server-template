import { Fail, Success } from "~helpers/response";
import emailTemplates from "~helpers/emailTemplates";
import {
  EMAIL_NOT_VERIFIED,
  SENT_EMAIL_OTP,
} from "~helpers/constants/responseCodes";
import {
  EMAIL_OTP_EXPIRES_IN,
  EMAIL_OTP_KEY_PREFIX,
} from "~helpers/constants/auth";
import QueryError from "~utils/errors/QueryError";
import { ACCOUNT_STATUS } from "~helpers/constants/models";

export default {
  Mutation: {
    async requestEmailOTP(
      _parent,
      { email },
      { locale, cache, t, otp, mailer, dataSources }
    ) {
      try {
        const user = await dataSources.users.findOne({ where: { email } });
        if (user) {
          const { firstName, id, emailVerified, status } = user;
          if (
            [ACCOUNT_STATUS.BLOCKED, ACCOUNT_STATUS.LOCKED].includes(status)
          ) {
            throw new QueryError(status);
          }

          const key = `${EMAIL_OTP_KEY_PREFIX}:${id}`;
          const sentToken = await cache.exists(key);

          if (!emailVerified) {
            throw new QueryError(EMAIL_NOT_VERIFIED);
          }

          if (!sentToken) {
            const token = otp.getEmailOTP();

            await cache.set(key, token, EMAIL_OTP_EXPIRES_IN);

            mailer.sendEmail({
              template: emailTemplates.OTP,
              message: {
                to: email,
              },
              locals: {
                locale,
                name: firstName,
                token,
              },
            });
          }
        }

        return Success({
          message: t(SENT_EMAIL_OTP),
          code: SENT_EMAIL_OTP,
        });
      } catch (e) {
        if (e instanceof QueryError) {
          return Fail({
            message: t(e.message),
            errors: e.errors,
          });
        }

        throw e;
      }
    },
  },
};
