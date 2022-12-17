!macro customInstall
  DetailPrint "Register ${PRODUCT_NAME} URL Handler"
  DeleteRegKey HKCR "${PRODUCT_NAME}"

  WriteRegStr HKCR "${PRODUCT_NAME}" "" "URL:${PRODUCT_NAME} Protocol"
  WriteRegStr HKCR "${PRODUCT_NAME}" "URL Protocol" ""

  WriteRegStr HKCR "${PRODUCT_NAME}\DefaultIcon" "" `"$INSTDIR\${APP_EXECUTABLE_FILENAME}"`
  WriteRegStr HKCR "${PRODUCT_NAME}\Shell" "" ""
  WriteRegStr HKCR "${PRODUCT_NAME}\Shell\Open" "" ""
  WriteRegStr HKCR "${PRODUCT_NAME}\Shell\Open\Command" "" `"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"`
!macroend

!macro customUnInstall
  DetailPrint "Delete ${PRODUCT_NAME} URL Handler"
  DeleteRegKey HKCR "${PRODUCT_NAME}"
!macroend
