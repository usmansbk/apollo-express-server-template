import links from "~helpers/links";
import { Success } from "~helpers/response";
import emailTemplates from "~helpers/emailTemplates";
import { SENT_VERIFICATION_EMAIL } from "~helpers/constants/responseCodes";
import {
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN,
  EMAIL_VERIFICATION_KEY_PREFIX,
} from "~helpers/constants/auth";
import { ACCOUNT_STATUS } from "~helpers/constants/models";

export default {
  Mutation: {
    async requestEmailVerification(
      _parent,
      { email },
      { locale, cache, t, jwt, mailer, dataSources, clients }
    ) {
      const { firstName, id, emailVerified, status } =
        await dataSources.users.findOne({
          where: { email },
        });

      if (!emailVerified || [ACCOUNT_STATUS.LOCKED].includes(status)) {
        const key = `${EMAIL_VERIFICATION_KEY_PREFIX}:${id}`;
        const { token, exp } = jwt.generateToken(
          {
            sub: id,
            aud: clients,
          },
          EMAIL_VERIFICATION_TOKEN_EXPIRES_IN
        );

        await cache.set(key, token, exp);

        mailer.sendEmail({
          template: emailTemplates.VERIFY_EMAIL,
          message: {
            to: email,
          },
          locals: {
            locale,
            name: firstName,
            link: links.verifyEmail(token),
          },
        });
      }

      return Success({
        message: t(SENT_VERIFICATION_EMAIL, { email }),
        code: SENT_VERIFICATION_EMAIL,
      });
    },
  },
};
