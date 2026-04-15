# Mapeo Excel -> BD

Archivo fuente: [docs/datos_ficticios_alumnos.xlsx](docs/datos_ficticios_alumnos.xlsx)
Hoja: `Datos`

Criterio general:
- Todo dato del Excel queda guardado en una tabla normalizada o en `alumno_excel_snapshot.raw_payload`.
- Si un campo se repite para padre/madre/apoderado, se guarda en `persona_contacto` y `persona_contacto_detalle`.
- `Comuna` y `Ciudad` se conservan en el snapshot y ademas se fusionan en `alumno.direccion`.
- `Lista` se conserva en `alumno_complemento.lista` y ademas puede inferir `beneficiario_alimentacion.activo`.

## 1) Alumno y matricula

- `Matr.` -> `alumno.matricula` (`directo`)
- `Rut` -> `alumno.rut` (`directo`)
- `Dv` -> `alumno.dv` (`directo`)
- `Paterno` -> `alumno.paterno` (`directo`)
- `Materno` -> `alumno.materno` (`directo`)
- `Nombres` -> `alumno.nombres` (`directo`)
- `Enseñanza` -> `curso.nombre_curso` + `matricula.id_curso` (`directo`)
- `Curso` -> `curso.nombre_curso` + `matricula.id_curso` (`directo`)
- `Sexo` -> `alumno.sexo` (`directo`)
- `Fecha Nac` -> `alumno.fecha_nacimiento` (`directo`)
- `Fecha Matrícula` -> `matricula.fecha_matricula` (`directo`)
- `Fecha Retiro` -> `matricula.fecha_retiro` (`directo`)
- `Fec. Inscripción` -> `matricula.fecha_inscripcion` (`directo`)
- `Repetidor` -> `matricula.repetidor` (`directo`)
- `Alumno_nuevo` -> `matricula.alumno_nuevo` (`directo`)
- `Fecha_actualizacion` -> `alumno.fecha_actualizacion` (`directo`)
- `Email` -> `alumno.email` (`directo`)
- `Teléfono` -> `alumno.telefono` (`directo`)
- `Dirección` -> `alumno.direccion` (`directo`)
- `Comuna` -> `alumno.direccion` + snapshot original (`parcial`)
- `Ciudad` -> `alumno.direccion` + snapshot original (`parcial`)

## 2) Complemento escolar

Tabla nueva: `alumno_complemento`

- `Lista` -> `alumno_complemento.lista` + regla de beneficiario (`directo`)
- `Estado` -> `alumno_complemento.estado` (`directo`)
- `Foto` -> `alumno_complemento.foto` (`directo`)
- `Condicionalidad` -> `alumno_complemento.condicionalidad` (`directo`)
- `Nacionalidad` -> `alumno_complemento.nacionalidad` (`directo`)
- `Religión` -> `alumno_complemento.religion` (`directo`)
- `Opta Religión` -> `alumno_complemento.opta_religion` (`directo`)
- `Cursos_repetidos` -> `alumno_complemento.cursos_repetidos` (`directo`)
- `Colegio_proc` -> `alumno_complemento.colegio_procedencia` (`directo`)
- `Retira_titular` -> `alumno_complemento.retira_titular` (`directo`)
- `Retira_Suplente` -> `alumno_complemento.retira_suplente` (`directo`)
- `Centro_costo` -> `alumno_complemento.centro_costo` (`directo`)
- `diagnostico_pie` -> `alumno_complemento.diagnostico_pie` (`directo`)
- `diagnostico_pie_escuela_lenguaje` -> `alumno_complemento.diagnostico_pie_escuela_lenguaje` (`directo`)
- `pie_tipo_discapacidad` -> `alumno_complemento.pie_tipo_discapacidad` (`directo`)
- `tx_etnia_indigena` -> `alumno_complemento.tx_etnia_indigena` (`directo`)

## 3) Salud

Tabla base: `salud`
Tabla nueva: `salud_detalle`

- `asma` -> `salud.asma` (`directo`)
- `diabetes` -> `salud.diabetes` (`directo`)
- `epilepsia` -> `salud.epilepsia` (`directo`)
- `Observaciones_salud` -> `salud.observaciones` (`directo`)
- `Peso` -> `salud_detalle.peso` (`directo`)
- `Talla` -> `salud_detalle.talla` (`directo`)
- `Grupo_sangre` -> `salud_detalle.grupo_sangre` (`directo`)
- `Problemas_visuales` -> `salud_detalle.problemas_visuales` (`directo`)
- `Problemas_auditivos` -> `salud_detalle.problemas_auditivos` (`directo`)
- `Problemas_cardiacos` -> `salud_detalle.problemas_cardiacos` (`directo`)
- `Problemas_columna` -> `salud_detalle.problemas_columna` (`directo`)

## 4) Emergencia

Tabla base: `emergencia`
Tabla nueva: `emergencia_detalle`

- `Avisar_a` -> `emergencia.avisar_a` (`directo`)
- `Telefono _emergencia` -> `emergencia.telefono_emergencia` (`directo`)
- `Trasladar_a` -> `emergencia.trasladar_a` (`directo`)
- `Seguro` -> `emergencia_detalle.seguro` (`directo`)
- `Isapre` -> `emergencia_detalle.isapre` (`directo`)
- `tx_obs_emergencia` -> `emergencia_detalle.tx_obs_emergencia` (`directo`)

## 5) Pago / bancario

Tabla base: `pago`
Tabla nueva: `pago_detalle`

- `Formapago_bancaria` -> `pago.forma_pago` (`directo`)
- `Banco` -> `pago.banco` (`directo`)
- `Tipo_cuenta_bancaria` -> `pago.tipo_cuenta` (`directo`)
- `Nu_cuenta_bancaria` -> `pago.numero_cuenta` (`directo`)
- `Co_banco` -> `pago_detalle.co_banco` (`directo`)
- `Nu_tarjeta_bancaria` -> `pago_detalle.nu_tarjeta_bancaria` (`directo`)
- `Fe_vencimiento_tarjeta` -> `pago_detalle.fe_vencimiento_tarjeta` (`directo`)

## 6) Apoyo y beneficio

Tabla base: `programa_apoyo`
Tabla base: `beneficiario_alimentacion`
Tabla base: `restriccion_dietaria`

- `Vulnerable` -> `programa_apoyo.vulnerable` (`directo`)
- `Prioritario` -> `programa_apoyo.prioritario` (`directo`)
- `Preferente` -> `programa_apoyo.preferente` (`directo`)
- `Pro-retencion` -> `programa_apoyo.pro_retencion` (`directo`)
- `Lista` -> `beneficiario_alimentacion.activo` cuando el valor indica beneficio (`parcial`)
- `alergia_medicamentos` -> `restriccion_dietaria.descripcion` con prefijo `Alergia medicamentos:` (`directo`)

## 7) Contactos

Tablas base: `persona_contacto`, `relacion_alumno_persona`
Tabla nueva: `persona_contacto_detalle`

### Padre
- `Rut_padre` -> `persona_contacto.rut`
- `Dv_padre` -> `persona_contacto.dv`
- `Paterno_padre` -> `persona_contacto.paterno`
- `Materno_padre` -> `persona_contacto.materno`
- `Nombre_padre` -> `persona_contacto.nombres`
- `Fecha_nac_padre` -> `persona_contacto_detalle.fecha_nacimiento`
- `Direccion_padre` -> `persona_contacto.direccion`
- `Telefono_padre` -> `persona_contacto.telefono`
- `Email_padre` -> `persona_contacto.email`
- `Empresa_padre` -> `persona_contacto_detalle.empresa`
- `Telefono_empresa_padre` -> `persona_contacto_detalle.telefono_empresa`
- `Estudios_padre` -> `persona_contacto_detalle.estudios`
- `Profesion_padre` -> `persona_contacto_detalle.profesion`
- `nacionalidad_padre` -> `persona_contacto_detalle.nacionalidad`

### Madre
- `Rut_madre` -> `persona_contacto.rut`
- `Dv_madre` -> `persona_contacto.dv`
- `Paterno_madre` -> `persona_contacto.paterno`
- `Materno_madre` -> `persona_contacto.materno`
- `Nombre_madre` -> `persona_contacto.nombres`
- `Fecha_nac_madre` -> `persona_contacto_detalle.fecha_nacimiento`
- `Direccion_madre` -> `persona_contacto.direccion`
- `Telefono_madre` -> `persona_contacto.telefono`
- `Email_madre` -> `persona_contacto.email`
- `Empresa_madre` -> `persona_contacto_detalle.empresa`
- `Telefono_empresa_madre` -> `persona_contacto_detalle.telefono_empresa`
- `Estudios_madre` -> `persona_contacto_detalle.estudios`
- `Profesion_madre` -> `persona_contacto_detalle.profesion`
- `nacionalidad_madre` -> `persona_contacto_detalle.nacionalidad`

### Apoderado
- `Rut_apoderado` -> `persona_contacto.rut`
- `Dv_apoderado` -> `persona_contacto.dv`
- `Paterno_apoderado` -> `persona_contacto.paterno`
- `Materno_apoderado` -> `persona_contacto.materno`
- `Nombre_apoderado` -> `persona_contacto.nombres`
- `Fecha_nac_apoderado` -> `persona_contacto_detalle.fecha_nacimiento`
- `Direccion_apoderado` -> `persona_contacto.direccion`
- `comuna_apoderado` -> `persona_contacto_detalle.comuna`
- `Telefono_apoderado` -> `persona_contacto.telefono`
- `Email_apoderado` -> `persona_contacto.email`
- `Empresa_apoderado` -> `persona_contacto_detalle.empresa`
- `Telefono_empresa_apoderado` -> `persona_contacto_detalle.telefono_empresa`
- `Estudios_apoderado` -> `persona_contacto_detalle.estudios`
- `Profesion_apoderado` -> `persona_contacto_detalle.profesion`
- `Autoriza_foto_apoderado` -> `relacion_alumno_persona.autoriza_foto` (`apoderado` y `apoderado2`)

## 8) Campos que no están en este Excel

- `codigo_barra` no aparece como columna de origen en el archivo.
- Todo el resto del contenido queda además guardado completo en `alumno_excel_snapshot.raw_payload` para trazabilidad.

## 9) Tablas nuevas creadas

- `alumno_complemento`: datos escolares complementarios del alumno.
- `persona_contacto_detalle`: datos extendidos de padre, madre y apoderados.
- `salud_detalle`: métricas y banderas de salud extendidas.
- `emergencia_detalle`: datos adicionales de emergencia.
- `pago_detalle`: datos bancarios extendidos.
- `alumno_excel_snapshot`: copia cruda de la fila importada.

## 10) Recomendacion operativa

Si vas a vaciar la BD para una carga realista:
- borra solo datos de negocio, no el esquema;
- luego recrea con `backend/init.sql`;
- y vuelve a importar el Excel completo.

Esto te deja una BD consistente con el archivo y con trazabilidad total de lo que entra.
