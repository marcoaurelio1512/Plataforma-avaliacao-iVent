import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "Plataforma-avaliacao-iVent";
export default defineRailway(() => {
  const PlataformaAvaliacaoIVent = service("Plataforma-avaliacao-iVent", {
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    // Reinicia só em falha (padrão do Railway, que o guarda como vazio), até 5 tentativas.
    deploy: { restartPolicyMaxRetries: 5 },
    source: github("marcoaurelio1512/Plataforma-avaliacao-iVent", { branch: "main", checkSuites: false }),
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas: { "us-west2": 1 },
    networking: { privateNetworkEndpoint: "plataforma-avaliacao-ivent" },
  });

  return project("Plataforma-avaliacao-iVent", {
    variables: { managed: false },
    resources: [PlataformaAvaliacaoIVent],
  });
});
