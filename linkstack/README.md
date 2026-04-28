# LinkStack deployment

This folder marks the LinkStack deployment for `get.servd.pro`.

Runtime configuration lives in the root `docker-compose.yml` so LinkStack can
join the existing Traefik-enabled Compose stack. Persistent data is stored in
the named Docker volume `servd-platform_linkstack_data`, mounted at `/htdocs`
inside the LinkStack container.

Traefik proxies to LinkStack's internal HTTPS port `443` and sends
`X-Forwarded-Proto=https`. LinkStack's persisted `/htdocs/.env` should also keep
`APP_URL=https://get.servd.pro` and `FORCE_HTTPS=true` so generated CSS, JS, and
image URLs use the public HTTPS origin.

## First-run setup

After launch, open `https://get.servd.pro` and complete the LinkStack setup
wizard.

Use these admin account details when prompted:

- Username: `Get.Servd.Pro`
- Email: `Get@Servd.Pro`

The Compose `SERVER_ADMIN` value sets Apache's server admin email. LinkStack
creates the application admin account through the setup wizard.

## Removal

To remove LinkStack later:

1. Delete the `linkstack` service block in `../docker-compose.yml`.
2. Delete the `linkstack_data` volume block in `../docker-compose.yml`.
3. Restore the legacy app router to `Host(\`get.servd.pro\`)` if the old Node
   app should reclaim the domain.
4. Apply the Compose change:

   ```bash
   docker compose up -d --remove-orphans
   ```

5. Remove persisted LinkStack data only if you no longer need it:

   ```bash
   docker volume rm servd-platform_linkstack_data
   ```
