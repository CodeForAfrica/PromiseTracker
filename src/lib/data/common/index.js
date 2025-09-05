export async function getPageProps(api, { locale, tenant }) {
  // get site settings
  const { docs } = await api.getCollection("site-settings", {
    locale,
    where: tenant ? { tenant: { equals: tenant } } : {},
  });
  const [siteSettings] = docs;
  return {
    siteSettings,
  };
}

export async function getGlobalProps(api, { locale, tenant }) {
  try {
    const { docs } = await api.getCollection("site-settings", {
      locale,
      where: tenant ? { tenant: { equals: tenant } } : {},
    });

    const [siteSettings] = docs;
    return {
      siteSettings,
      locale,
      tenant,
    };
  } catch (error) {
    return {
      siteSettings: null,
      locale: locale || "en",
      tenant: tenant || null,
    };
  }
}
