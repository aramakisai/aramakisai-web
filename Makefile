KUBECTL_CONF := /tmp/kubeconfig-aramakisai

.PHONY: kubectl

kubectl: ## kubectl を Infisical 経由で実行 (例: make kubectl ARGS="get pods -A")
	@infisical run --env=prod -- bash -c \
		'echo "$$KUBECONFIG" > $(KUBECTL_CONF) && chmod 600 $(KUBECTL_CONF) && kubectl --kubeconfig=$(KUBECTL_CONF) $(ARGS)'
