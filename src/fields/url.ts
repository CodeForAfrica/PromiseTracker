import { type Field, ValidationError, deepMerge } from "payload";

interface Args {
  overrides?: Partial<Field>;
}
export const url = ({ overrides = {} }: Args = {}): Field => {
  const urlResult: Field = {
    name: "url",
    type: "text",
    label: "URL",
    validate: (value: string | undefined | null) => {
      if (!value) return true; // Assuming we can allow empty values

      try {
        new URL(value);
      } catch (e) {
        if (e instanceof TypeError) {
          throw new ValidationError({
            errors: [
              {
                message: "Please enter a valid URL",
                path: "url",
              },
            ],
          });
        }
        return "Please enter valid URL";
      }
      return true;
    },
  };

  return deepMerge(urlResult, overrides);
};
