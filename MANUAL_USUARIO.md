# Manual de Usuario - Sistema de Gestión de ODTs (APC)

Este documento sirve como guía completa para el uso de la plataforma de gestión de Órdenes de Trabajo (ODTs) de APC. La plataforma está diseñada para centralizar el flujo de trabajo desde la creación hasta el cierre y facturación de cada proyecto.

---

## 1. Conceptos Generales y Roles de Usuario

El sistema utiliza un Control de Acceso Basado en Roles (RBAC) para asegurar que cada usuario vea y realice solo las acciones permitidas según su perfil y departamento.

### Perfiles de Usuario:
*   **Administrador:** Acceso total a todas las funcionalidades, configuración de usuarios, clientes y visualización de todas las ODTs.
*   **Cuentas (Ejecutivo/Líder):** Propietarios de las ODTs. Responsables de la creación, gestión del brief, revisión de calidad final y comunicación con el cliente.
*   **Líder Operativo:** Responsable de asignar tareas dentro de su área (Diseño, Digital, Médico, etc.) y supervisar el progreso.
*   **Operativo:** Ejecutor de las tareas técnicas. Sube materiales y marca avances.
*   **Corrección / QA:** Responsables de la revisión técnica y de calidad. Pueden aprobar o rechazar entregas.
*   **Médico (Líder/Operativo):** Comparten responsabilidades con QA para asegurar la precisión médica de los materiales.
*   **Administración / Finanzas:** Responsables de la etapa final de facturación.

---

## 2. Bandeja Operativa y Archivo de Clientes

La **Bandeja Operativa** es el centro de control diario. El **Archivo de Clientes** permite consultar históricos.

### Campos de la Tabla:
*   **ODT ID:** Identificador único.
    *   ⚠️ **Icono de Alerta:** Aparece si la ODT ha sido rechazada 2 o más veces por QA.
    *   🚨 **Alarma Activa:** Indica un problema crítico reportado.
*   **Proyecto / Cliente:** Nombre de la empresa, marca, producto y categorías.
*   **Responsable:** Usuario asignado actualmente. Si no hay asignación, muestra al Líder del Área.
*   **Status:** Estado actual (Ej: BRIEF, PRODUCCIÓN, REVISIÓN QA, CIERRE, FACTURACIÓN).
    *   **Colores:** Verde (Aprobada), Rojo (Rechazada/Crítico), Ámbar (QA/Correcciones).
*   **Entrega / Prioridad:** Fecha límite y semáforo de prioridad (Baja, Media, Alta, Crítica).
*   **SLA (Service Level Agreement):** Indicador de tiempo. Muestra "CRÍTICO" si la fecha de entrega está vencida o próxima.

---

## 3. Flujo de Trabajo (Roadmap)

Cada ODT sigue un camino dinámico basado en las áreas seleccionadas al inicio.

1.  **BRIEF:** Etapa inicial donde Cuentas define los requerimientos.
2.  **PRODUCCIÓN (Áreas):** La ODT pasa por las áreas técnicas (Diseño, Adaptaciones, Digital, Médico, etc.).
3.  **REVISIÓN QA:** Filtro de calidad donde Corrección o el equipo Médico validan el material.
4.  **CUENTAS (Cierre):**
    *   **Revisión de Cuentas:** El ejecutivo valida que todo esté según el brief.
    *   **Presentación:** Se genera el link final para el cliente.
    *   **Feedback Cliente:** El cliente aprueba, pide correcciones o rechaza.
5.  **FACTURACIÓN:** Administración procesa el cobro.
6.  **FINALIZADO:** ODT cerrada exitosamente.

---

## 4. Detalle de la ODT y Funcionalidades

Al entrar en el **Detalle**, se habilitan diversas herramientas según la etapa:

### Gestión de Brief:
*   Edición de requerimientos técnicos y objetivos.
*   Carga de archivos de referencia.

### Gestión de Materiales (Especial para PARRILLA RRSS):
*   Para proyectos de redes sociales, se pueden añadir materiales individuales (Post 1, Video 2, etc.).
*   Cada material tiene su propio estado: *Pendiente, En Proceso, Correcciones, Aprobado/Publicado*.
*   **Auto-Cierre:** Si todos los materiales de una parrilla están "Aprobados/Publicados", la ODT se cierra automáticamente.

### Caja de QA (Gate de Calidad):
*   **Aprobar:** Envía la ODT a la siguiente etapa (otra área o Cierre).
*   **Rechazar:** Devuelve la ODT al área operativa anterior.
    *   **Contador de Rechazos:** Cada rechazo incrementa un contador interno.
    *   **Escalación:** Al 2do rechazo, se dispara una alerta urgente al Líder del Área y al Propietario.

### Etapa de Cierre y Feedback:
*   **Link de Presentación:** Campo obligatorio para enviar al cliente.
*   **Acciones de Cliente:**
    *   **Aprobado:** Pasa a Facturación.
    *   **Aprobado con Correcciones:** Permite avanzar pero dejando registro de cambios menores.
    *   **Rechazado:** Devuelve la ODT a un área específica para rehacer el trabajo.

### Auditoría ISO 9001:
*   Funcionalidad asistida por IA para verificar que la ODT cumple con los estándares de calidad de la empresa antes del cierre.

---

## 5. Avisos y Alertas Visuales

*   **Alertas de Correcion (Amarillo):** Notifican al Ejecutivo de Cuentas que su ODT requiere cambios.
*   **Alertas Urgentes (Rojo):** Notifican a los Líderes cuando un proceso está estancado o ha sido rechazado múltiples veces.
*   **Notificaciones en Campana:** Avisos directos sobre asignaciones, aprobaciones y comentarios nuevos.

---

## 6. Trazabilidad y Comentarios

Al final del detalle, existe un log de **Trazabilidad** que registra:
*   Quién movió la ODT y a qué hora.
*   Comentarios de QA sobre por qué se rechazó un material.
*   Instrucciones adicionales de Cuentas.

---

**Nota:** Este sistema es una herramienta viva. Ante cualquier duda técnica, contacte al administrador del sistema.
